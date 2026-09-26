import React from 'react';
import { CATEGORIAS } from '../lib/apresentacao.js';
import { Chip } from './UI.jsx';
export default function CategoriasLote({ valor, onChange }) {
  return <fieldset className="category-picker"><legend className="lbl">Categorias do lote</legend><div className="chips">{[...new Set([...CATEGORIAS, ...valor])].map(c =>
    <Chip key={c} ativo={valor.includes(c)} onClick={() => onChange(valor.includes(c) ? valor.filter(v => v !== c) : [...valor, c])}>{valor.includes(c) ? '✓ ' : ''}{c}</Chip>
  )}</div><p className="hint">Selecione pelo menos uma categoria.</p></fieldset>;
}
