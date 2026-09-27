import React, { useRef, useState } from 'react';
import { editarLote } from '../lib/manutencao.js';
import { categoriasDoLote } from '../lib/categorias.js';
import CategoriasLote from '../components/CategoriasLote.jsx';
import { PageTitle, Voltar } from '../components/UI.jsx';
export default function EditarLote({ registroEdicao, navegar, avisar }) {
  const [original] = useState(registroEdicao);
  const [nome, setNome] = useState(original?.nome || '');
  const [categorias, setCategorias] = useState(categoriasDoLote(original));
  const [erro, setErro] = useState(''), [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  if (!original) return <p>Este lote não está mais disponível.</p>;
  async function salvar(e) {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true; setOcupado(true); setErro('');
    try { await editarLote({ id: original.id, nome, categorias }, original); avisar('Lote atualizado.'); navegar('lote', original.id); }
    catch (e) { setErro(e.message); } finally { enviando.current = false; setOcupado(false); }
  }
  return <><Voltar onClick={() => navegar('lote', original.id)} /><PageTitle icon="lotes">Editar lote</PageTitle><p className="hint">O saldo é calculado pelos registros do lote.</p><form onSubmit={salvar}><fieldset disabled={ocupado}><label className="lbl" htmlFor="lote-nome">Nome</label><input id="lote-nome" className="input" required value={nome} onChange={e => setNome(e.target.value)} /><CategoriasLote valor={categorias} onChange={setCategorias} />{erro && <p role="alert" className="erro">{erro}</p>}<button className="btn salvar">{ocupado ? 'Salvando…' : 'Salvar lote'}</button></fieldset></form></>;
}
