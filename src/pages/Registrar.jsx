import React, { useRef, useState } from 'react';
import { ativos, conferirVersao, validarHistorico, salvarPasto } from '../lib/manutencao.js';
import { db, novoId } from '../lib/db.js';
import { conferirDestinoAtual } from '../lib/pastos.js';
import { salvarRegistro } from '../lib/sync.js';
import { saldoDoLote, pastoAtualDoLote, GESTACAO_DIAS } from '../lib/calc.js';
import { TIPOS, hojeISO } from '../lib/apresentacao.js';
import { Chip, EmptyState, EscolherPasto, Icon, LinhaLote, PageTitle, Quantidade, Voltar } from '../components/UI.jsx';

export default function Registrar({ loteId: inicial, tipoInicial, lotes, eventos, pastos, pastosHistorico = pastos, navegar, avisar, registroEdicao }) {
  const [original] = useState(registroEdicao);
  const [loteId, setLoteId] = useState(original?.loteId || inicial || '');
  const [tipo, setTipo] = useState(original?.tipo || tipoInicial || '');
  const [form, setForm] = useState({ qtd: 0, peso: '', produto: '', carencia: 0, pastoId: '', pastoNome: '', data: hojeISO(), fim: '', obs: '', ...Object.fromEntries(Object.entries(original || {}).map(([k, v]) => [k, v ?? ''])) });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ocupado = useRef(false);
  const alterar = (campo, valor) => { setForm(f => ({ ...f, [campo]: valor })); setErro(''); };
  const lote = lotes.find(l => l.id === loteId);
  const temQuantidade = ['compra', 'nascimento', 'venda', 'morte', 'prenhez'].includes(tipo);
  const limitado = ['venda', 'morte', 'prenhez'].includes(tipo);

  async function salvar(e) {
    e.preventDefault();
    if (ocupado.current) return;
    const qtd = Number(form.qtd);
    const peso = Number(String(form.peso).replace(',', '.'));
    if (!lote || !TIPOS[tipo]) return setErro('Escolha o lote e o tipo de registro.');
    if (!form.data) return setErro('Informe a data.');
    if (temQuantidade && (!Number.isSafeInteger(qtd) || qtd < 1)) return setErro('Informe uma quantidade inteira maior que zero.');
    if (tipo === 'pesagem' && (!Number.isFinite(peso) || peso <= 0)) return setErro('Informe o peso médio em kg.');
    if (tipo === 'vacina' && (!form.produto.trim() || !Number.isSafeInteger(Number(form.carencia)) || Number(form.carencia) < 0)) return setErro('Informe o produto e uma carência inteira de zero ou mais dias.');
    if (tipo === 'monta' && form.fim && form.fim < form.data) return setErro('O fim da monta não pode ser antes do início.');
    if (tipo === 'troca' && (!form.pastoId || (form.pastoId === 'novo' && !form.pastoNome.trim()))) return setErro('Escolha o potreiro e informe o nome, se for novo.');
    ocupado.current = true;
    setSalvando(true);
    setErro('');
    try {
      const criadoEm = new Date().toISOString();
      const registro = { id: original?.id || novoId(), loteId, tipo, data: form.data, criadoEm: original?.criadoEm || criadoEm };
      if (temQuantidade) registro.qtd = qtd;
      if (tipo === 'pesagem') registro.peso = peso;
      if (tipo === 'vacina') Object.assign(registro, { produto: form.produto.trim(), carencia: Number(form.carencia) });
      if (tipo === 'monta') registro.fim = form.fim || form.data;
      registro.obs = form.obs.trim() || null;
      await db.transaction('rw', db.pastos, db.lotes, db.eventos, db.fila_sync, async () => {
        // Confere o saldo dentro da transação, inclusive após alterações em outra aba.
        conferirVersao(await db.lotes.get(loteId));
        if (original) conferirVersao(await db.eventos.get(original.id), original);
        const atuais = ativos(await db.eventos.where('loteId').equals(loteId).toArray()).filter(e => e.id !== registro.id);
        if (tipo === 'prenhez' && qtd > saldoDoLote(loteId, atuais)) throw new Error('A quantidade informada é maior que o saldo atual do lote.');
        if (tipo === 'troca') {
          if (form.pastoId === pastoAtualDoLote(loteId, atuais.filter(e => e.data <= form.data))) throw new Error('O lote já está nesse potreiro.');
          registro.pastoId = form.pastoId === 'novo' ? novoId() : form.pastoId;
          if (form.pastoId === 'novo') await salvarPasto(form.pastoNome, null, registro.pastoId);
          else if (!(original?.pastoId === registro.pastoId && original.data === registro.data)) conferirVersao(await db.pastos.get(registro.pastoId));
        }
        validarHistorico(loteId, [...atuais, registro]);
        conferirDestinoAtual(loteId, original ? [...atuais, original] : atuais, [...atuais, registro], await db.pastos.toArray());
        await salvarRegistro('eventos', registro);
      });
      avisar('Registro salvo neste aparelho.');
      navegar('lote', loteId);
    } catch (error) {
      setErro(error.name === 'Error' ? error.message : 'Não foi possível salvar. Seus campos foram mantidos; tente novamente.');
    } finally {
      ocupado.current = false;
      setSalvando(false);
    }
  }

  if (original && !lote) return <><Voltar onClick={() => navegar('historico')} /><p role="status">O lote deste registro não está mais disponível. A edição não foi salva.</p></>;
  if (!lote) return <><PageTitle icon="registrar">Registrar</PageTitle><p className="sub subtitle">Qual lote?</p>
    {lotes.length ? <ul className="list page-list">{lotes.map(l => <li key={l.id}><LinhaLote lote={l} eventos={eventos} pastos={pastosHistorico} onClick={() => setLoteId(l.id)} /></li>)}</ul> : <EmptyState icon="lotes" title="Escolha seu primeiro lote"><p>Cadastre um lote para fazer registros.</p><button className="btn" onClick={() => navegar('novoLote')}><Icon nome="novoLote" />Criar primeiro lote</button></EmptyState>}
  </>;
  if (!tipo) return <><Voltar onClick={() => setLoteId('')}>Mudar o lote</Voltar><h1>{lote.nome}</h1><p className="sub subtitle">O que aconteceu?</p>
    <div className="tipos">{Object.entries(TIPOS).filter(([id]) => !['monta', 'prenhez'].includes(id)).map(([id, t]) => <button key={id} className="tipo" onClick={() => setTipo(id)}><Icon nome={id} size={26} /><strong>{t.nome}</strong><span>{t.dica}</span></button>)}</div>
    <p className="hint page-list">Menos comuns</p><div className="tipos">{['monta', 'prenhez'].map(id => <button key={id} className="tipo raro" onClick={() => setTipo(id)}><Icon nome={id} size={26} /><strong>{TIPOS[id].nome}</strong><span>{TIPOS[id].dica}</span></button>)}</div>
  </>;
  return <>
    <Voltar onClick={() => { if (original) navegar('lote', loteId); else { setTipo(''); setErro(''); } }}>{original ? 'Cancelar edição' : 'Mudar o tipo'}</Voltar><PageTitle icon={tipo}>{TIPOS[tipo].nome}</PageTitle><p className="sub subtitle">{lote.nome}</p>
    <form onSubmit={salvar}><fieldset disabled={salvando}>
      {temQuantidade && <><Quantidade valor={form.qtd} onChange={v => alterar('qtd', v)} todas={limitado ? saldoDoLote(loteId, eventos) : undefined} />{limitado && <p className="hint">Este lote tem {saldoDoLote(loteId, eventos)} cabeças.</p>}</>}
      {tipo === 'troca' && <EscolherPasto pastos={pastos} valor={form.pastoId} onChange={v => alterar('pastoId', v)} novoNome={form.pastoNome} onNomeChange={v => alterar('pastoNome', v)} />}
      {tipo === 'pesagem' && <><label className="lbl" htmlFor="peso">Peso médio do lote</label><div className="suffix"><input id="peso" className="input" inputMode="decimal" required value={form.peso} onChange={e => alterar('peso', e.target.value)} /><i>kg</i></div></>}
      {tipo === 'vacina' && <>
        <label className="lbl" htmlFor="produto">Qual vacina ou remédio?</label><input id="produto" className="input" required value={form.produto} onChange={e => alterar('produto', e.target.value)} />
        <div className="chips quick">{['Vermífugo', 'Clostridiose', 'Brucelose', 'Carrapaticida'].map(p => <Chip key={p} ativo={form.produto === p} onClick={() => alterar('produto', p)}>{p}</Chip>)}</div>
        <label className="lbl" htmlFor="carencia">Carência em dias</label><input id="carencia" className="input" type="number" min="0" step="1" required value={form.carencia} onChange={e => alterar('carencia', e.target.value)} />
        <div className="chips quick">{[0, 7, 14, 28, 35].map(n => <Chip key={n} ativo={Number(form.carencia) === n} onClick={() => alterar('carencia', n)}>{n ? `${n} dias` : 'Sem carência'}</Chip>)}</div>
        <p className="hint">O app avisa no início enquanto a carência estiver valendo.</p>
      </>}
      <label className="lbl" htmlFor="data">{tipo === 'monta' ? 'Início da monta ou data da inseminação' : 'Data'}</label><input id="data" className="input" type="date" required value={form.data} onChange={e => alterar('data', e.target.value)} />
      {tipo === 'monta' && <><label className="lbl" htmlFor="fim">Fim da monta (opcional)</label><input id="fim" className="input" type="date" min={form.data} value={form.fim} onChange={e => alterar('fim', e.target.value)} /><p className="hint">Se foi uma inseminação de um dia só, deixe o fim em branco. O app conta cerca de {GESTACAO_DIAS} dias de gestação.</p></>}
      <label className="lbl" htmlFor="obs">Anotação (opcional)</label><input id="obs" className="input" value={form.obs} onChange={e => alterar('obs', e.target.value)} />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button type="submit" className="btn salvar"><Icon nome="salvar" />{salvando ? 'Salvando…' : original ? 'Salvar alterações' : 'Salvar registro'}</button>
    </fieldset></form>
  </>;
}
