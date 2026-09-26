import React, { useRef, useState } from 'react';
import { salvarPasto } from '../lib/manutencao.js';
import { usoDoPasto } from '../lib/pastos.js';
import { numero } from '../lib/apresentacao.js';
import { EmptyState, Icon, PageTitle, Voltar } from '../components/UI.jsx';
import AcoesRegistro from '../components/AcoesRegistro.jsx';

export default function Pastos({ pastos, lotes, eventos, navegar, avisar }) {
  const [form, setForm] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ocupado = useRef(false);
  function abrir(registro = null) { setErro(''); setForm({ original: registro, nome: registro?.nome || '' }); }
  async function salvar(e) {
    e.preventDefault(); if (ocupado.current) return;
    ocupado.current = true; setSalvando(true); setErro('');
    try { await salvarPasto(form.nome, form.original); setForm(null); avisar('Pasto salvo neste aparelho.'); }
    catch (e) { setErro(e.message); }
    finally { ocupado.current = false; setSalvando(false); }
  }
  if (form) return <><Voltar onClick={() => setForm(null)}>Cancelar</Voltar><PageTitle icon="pastos">{form.original ? 'Editar pasto' : 'Novo pasto'}</PageTitle><form onSubmit={salvar}><fieldset disabled={salvando}>
    <label className="lbl" htmlFor="pasto-nome">Nome</label><input autoFocus id="pasto-nome" className="input" required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
    {erro && <p className="erro" role="alert">{erro}</p>}<button className="btn salvar"><Icon nome="salvar" />{salvando ? 'Salvando…' : 'Salvar pasto'}</button>
  </fieldset></form></>;
  return <><Voltar onClick={() => navegar('home')}>Início</Voltar><PageTitle icon="pastos">Pastos e potreiros</PageTitle><p className="sub subtitle">Cadastre e organize os locais usados pelos lotes.</p>
    {pastos.length ? <><button className="btn ghost" onClick={() => abrir()}><Icon nome="registrar" />Novo pasto</button><ul className="list pasture-list">{[...pastos].sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => {
      const uso = usoDoPasto(p.id, lotes, eventos);
      return <li key={p.id} className="reading-row"><div><strong>{p.nome}</strong><p className="hint">{uso.lotes} {uso.lotes === 1 ? 'lote' : 'lotes'} · {numero(uso.cabecas)} cabeças</p></div><AcoesRegistro tabela="pastos" registro={p} editar={() => abrir(p)} avisar={avisar} /></li>;
    })}</ul></> : <EmptyState icon="pastos" title="Nenhum pasto cadastrado ainda."><button className="btn" onClick={() => abrir()}>Cadastrar primeiro pasto</button></EmptyState>}
  </>;
}
