import AcoesRegistro from '../components/AcoesRegistro.jsx';
import React from 'react';
import { categoriasDoLote } from '../lib/categorias.js';
import { saldoDoLote, pastoAtualDoLote, pesagensDoLote, ganhoMedioDiario, janelaDePartos } from '../lib/calc.js';
import { dataFormatada, nomePasto, numero } from '../lib/apresentacao.js';
import { Icon, SectionTitle, Voltar } from '../components/UI.jsx';
import { ListaEventos } from './Historico.jsx';

export default function Lote({ loteId, lotes, eventos, pastos, navegar, avisar }) {
  const lote = lotes.find(l => l.id === loteId);
  if (!lote) return <><Voltar onClick={() => navegar('lotes')} /><p role="status">Este lote não está mais disponível.</p></>;
  const ultima = pesagensDoLote(loteId, eventos).at(-1);
  const ganho = ganhoMedioDiario(loteId, eventos);
  const partos = janelaDePartos(loteId, eventos);
  return <>
    <Voltar onClick={() => navegar('lotes')} />
    <div className="lote-summary"><h1>{lote.nome}</h1><AcoesRegistro tabela="lotes" registro={lote} avisar={avisar} editar={() => navegar('editarLote', loteId, null, lote)} depoisExcluir={() => navegar('lotes')} />
    <p className="sub subtitle">{categoriasDoLote(lote).join(' · ')} em {nomePasto(pastoAtualDoLote(loteId, eventos), pastos)}</p>
    <div className="saldo">{numero(saldoDoLote(loteId, eventos))}<small>cabeças</small></div>
    {ultima ? <dl className="stats"><div><dt>Peso médio</dt><dd>{numero(ultima.peso, 1)} kg</dd><small>pesado em {dataFormatada(ultima.data)}</small></div><div><dt>Ganho por dia</dt><dd>{ganho === null ? '–' : `${numero(ganho, 2)} kg`}</dd><small>{ganho === null ? 'precisa de 2 pesagens em dias diferentes' : 'entre as duas últimas pesagens'}</small></div></dl> : <p className="hint">Este lote ainda não tem pesagem. Toque em Pesar para registrar a primeira.</p>}
    </div>
    {partos && <section className="home-section surface"><SectionTitle icon="nascimento">Partos</SectionTitle><p>Previstos de <b>{dataFormatada(partos.inicio)}</b> a <b>{dataFormatada(partos.fim)}</b>.</p>
      {partos.esperado > 0 && <div className="prog" aria-hidden="true"><span style={{ width: `${Math.min(100, partos.nascidos / partos.esperado * 100)}%` }} /></div>}
      <p className="hint">Nasceram {partos.nascidos}{partos.esperado !== null ? ` de cerca de ${partos.esperado} esperados.` : ' até agora. Registre o diagnóstico de gestação para estimar quantos partos esperar.'}</p>
    </section>}
    <section className="home-section"><SectionTitle icon="registrar">Registrar neste lote</SectionTitle><div className="acoes">{[['pesagem', 'Pesar'], ['venda', 'Vender'], ['troca', 'Mudar de potreiro'], ['vacina', 'Vacina ou remédio']].map(([tipo, nome]) => <button key={tipo} className="btn action-btn" onClick={() => navegar('registrar', loteId, tipo)}><Icon nome={tipo} size={26} />{nome}</button>)}<button className="btn ghost full" onClick={() => navegar('registrar', loteId)}><Icon nome="registrar" />Outro registro</button></div></section>
    <section className="home-section"><SectionTitle icon="historico">Histórico do lote</SectionTitle><ListaEventos navegar={navegar} avisar={avisar} eventos={eventos.filter(e => e.loteId === loteId)} lotes={lotes} pastos={pastos} mostrarLote={false} /></section>
  </>;
}
