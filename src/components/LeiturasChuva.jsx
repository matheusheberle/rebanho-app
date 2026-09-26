import React from 'react';
import AcoesRegistro from './AcoesRegistro.jsx';
import { dataFormatada, numero } from '../lib/apresentacao.js';
export default function LeiturasChuva({ chuvas, navegar, avisar }) {
  if (!chuvas.length) return <p className="hint">Nenhuma leitura registrada.</p>;
  return <details className="rain-readings"><summary>Ver e corrigir leituras ({chuvas.length})</summary><ul className="list">
    {[...chuvas].sort((a, b) => b.data.localeCompare(a.data)).map(r => <li key={r.id} className="reading-row"><div><strong>{dataFormatada(r.data)} · {numero(r.mm, 1)} mm</strong>{r.obs && <p className="hint">{r.obs}</p>}{chuvas.some(c => c.id !== r.id && c.data === r.data) && <p className="erro">Data duplicada: confira as leituras e exclua a incorreta antes de editar a que deseja manter.</p>}</div><AcoesRegistro tabela="chuvas" registro={r} avisar={avisar} editar={() => navegar('registrarChuva', null, null, r)} /></li>)}
  </ul></details>;
}
