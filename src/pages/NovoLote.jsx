import React, { useRef, useState } from 'react';
import { db, novoId } from '../lib/db.js';
import { salvarRegistro } from '../lib/sync.js';
import { hojeISO } from '../lib/apresentacao.js';
import CategoriasLote from '../components/CategoriasLote.jsx';
import { EscolherPasto, Icon, PageTitle, Quantidade, Voltar } from '../components/UI.jsx';

export default function NovoLote({ lotes, pastos, navegar, avisar }) {
  const [nome, setNome] = useState('');
  const [categorias, setCategorias] = useState(['Novilhos']);
  const [pastoId, setPastoId] = useState(pastos[0]?.id || 'novo');
  const [pastoNome, setPastoNome] = useState('');
  const [qtd, setQtd] = useState(0);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ocupado = useRef(false);

  async function salvar(e) {
    e.preventDefault();
    if (ocupado.current) return;
    if (!categorias.length) return setErro('Selecione pelo menos uma categoria.');
    if (!Number.isSafeInteger(Number(qtd)) || Number(qtd) < 1) return setErro('Informe quantas cabeças tem o lote.');
    if (pastoId === 'novo' && !pastoNome.trim()) return setErro('Digite o nome do potreiro.');
    ocupado.current = true;
    setSalvando(true);
    setErro('');
    try {
      const criadoEm = new Date().toISOString();
      const id = novoId();
      const destino = pastoId === 'novo' ? novoId() : pastoId;
      await db.transaction('rw', db.pastos, db.lotes, db.eventos, db.fila_sync, async () => {
        if (pastoId === 'novo') await salvarRegistro('pastos', { id: destino, nome: pastoNome.trim(), criadoEm });
        await salvarRegistro('lotes', { id, nome: nome.trim() || `Lote ${lotes.length + 1}`, categorias, criadoEm });
        await salvarRegistro('eventos', { id: novoId(), tipo: 'inicial', loteId: id, data: hojeISO(), qtd: Number(qtd), pastoId: destino, criadoEm });
      });
      avisar('Lote criado e salvo neste aparelho.');
      navegar('lote', id);
    } catch {
      setErro('Não foi possível salvar o lote. Seus campos foram mantidos; tente novamente.');
    } finally {
      ocupado.current = false;
      setSalvando(false);
    }
  }
  return <>
    <Voltar onClick={() => navegar('lotes')} /><PageTitle icon="novoLote">Novo lote</PageTitle>
    <form onSubmit={salvar}><fieldset disabled={salvando}>
      <label className="lbl" htmlFor="lote-nome">Nome</label><input id="lote-nome" className="input" placeholder={`Lote ${lotes.length + 1}`} value={nome} onChange={e => setNome(e.target.value)} />
      <CategoriasLote valor={categorias} onChange={setCategorias} />
      <EscolherPasto pastos={pastos} valor={pastoId} onChange={setPastoId} novoNome={pastoNome} onNomeChange={setPastoNome} />
      <Quantidade valor={qtd} onChange={setQtd} />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="btn salvar" type="submit"><Icon nome="salvar" />{salvando ? 'Salvando…' : 'Criar lote'}</button>
    </fieldset></form>
  </>;
}
