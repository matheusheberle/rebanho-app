import React from 'react';
import { categoriasDoLote } from '../lib/categorias.js';
import { saldoDoLote, pastoAtualDoLote, pesagensDoLote, ganhoMedioDiario } from '../lib/calc.js';
import { nomePasto, numero } from '../lib/apresentacao.js';
import Icon from './Icon.jsx';
export { default as Icon } from './Icon.jsx';

export function SectionTitle({ icon, children, id }) {
  return <h2 id={id} className="section-title"><span className="section-icon"><Icon nome={icon} /></span>{children}</h2>;
}
export function PageTitle({ icon, children }) {
  return <h1 className="page-title"><Icon nome={icon} size={28} />{children}</h1>;
}
export function EmptyState({ icon, title, children }) {
  return <div className="empty"><span className="empty-icon"><Icon nome={icon} size={28} /></span><strong>{title}</strong>{children}</div>;
}
export function Voltar({ children = 'Lotes', onClick }) {
  return <button type="button" className="back" onClick={onClick}><Icon nome="back" />{children}</button>;
}
export function Chip({ ativo, onClick, children }) {
  return <button type="button" className="chip" aria-pressed={ativo} onClick={onClick}>{children}</button>;
}
export function Quantidade({ valor, onChange, todas }) {
  const alterar = delta => onChange(Math.max(0, (Number(valor) || 0) + delta));
  return <>
    <label className="lbl" htmlFor="quantidade">Quantas cabeças?</label>
    <div className="stepper">
      <button type="button" className="round" aria-label="Diminuir" onClick={() => alterar(-1)}>−</button>
      <input id="quantidade" className="qty" type="number" min="1" step="1" required inputMode="numeric" value={valor} onChange={e => onChange(e.target.value)} />
      <button type="button" className="round" aria-label="Aumentar" onClick={() => alterar(1)}>+</button>
    </div>
    <div className="chips quick">{[5, 10, 20].map(n => <Chip key={n} onClick={() => alterar(n)}>+{n}</Chip>)}
      {todas !== undefined && <Chip onClick={() => onChange(todas)}>Todas</Chip>}
      <Chip onClick={() => onChange(0)}>Zerar</Chip>
    </div>
  </>;
}
export function EscolherPasto({ pastos, valor, onChange, novoNome, onNomeChange }) {
  return <>
    <fieldset><legend className="lbl">Em qual potreiro?</legend>
      <div className="chips">{pastos.map(p => <Chip key={p.id} ativo={valor === p.id} onClick={() => onChange(p.id)}>{p.nome}</Chip>)}
        <Chip ativo={valor === 'novo'} onClick={() => onChange('novo')}>Outro potreiro</Chip>
      </div>
    </fieldset>
    {valor === 'novo' && <><label className="lbl" htmlFor="pasto-nome">Nome do potreiro</label><input id="pasto-nome" className="input" required value={novoNome} onChange={e => onNomeChange(e.target.value)} /></>}
  </>;
}
export function LinhaLote({ lote, eventos, pastos, onClick }) {
  const ultima = pesagensDoLote(lote.id, eventos).at(-1);
  const ganho = ganhoMedioDiario(lote.id, eventos);
  return <button className="row lote-row" onClick={onClick}>
    <span className="lote-count"><span className="row-n">{numero(saldoDoLote(lote.id, eventos))}</span><small>cabeças</small></span>
    <span className="row-main"><strong>{lote.nome}</strong>
      <span className="category-label">{categoriasDoLote(lote).join(' · ')}</span>
      <span className="row-meta"><Icon nome="localizacao" size={16} />{nomePasto(pastoAtualDoLote(lote.id, eventos), pastos)}</span>
      <span className="row-meta"><Icon nome="pesagem" size={16} />{ultima ? `${numero(ultima.peso, 1)} kg${ganho !== null ? ` · ${numero(ganho, 2)} kg/dia` : ''}` : 'Ainda sem pesagem'}</span>
    </span><Icon nome="chev" />
  </button>;
}
