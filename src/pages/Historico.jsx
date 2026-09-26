import React, { useState } from 'react';
import { Chip, EmptyState, Icon, PageTitle } from '../components/UI.jsx';
import { TIPOS, dataFormatada, nomePasto, numero } from '../lib/apresentacao.js';

function descricao(e, pastos) {
  if (e.tipo === 'inicial') return `Início do lote: ${numero(e.qtd)} cabeças`;
  if (e.tipo === 'pesagem') return `Peso médio: ${numero(e.peso, 1)} kg`;
  if (e.tipo === 'troca') return `Mudança para ${nomePasto(e.pastoId, pastos)}`;
  if (e.tipo === 'vacina') return `${e.produto}${e.carencia ? ` · carência de ${e.carencia} dias` : ' · sem carência'}`;
  if (e.tipo === 'monta') return `Monta: ${dataFormatada(e.data)} a ${dataFormatada(e.fim || e.data)}`;
  return `${TIPOS[e.tipo]?.nome || e.tipo}${e.qtd != null ? `: ${numero(e.qtd)} ${e.tipo === 'prenhez' ? 'vacas prenhas' : 'cabeças'}` : ''}`;
}

export function ListaEventos({ eventos, lotes, pastos, mostrarLote = true }) {
  const ordenados = [...eventos].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  if (!ordenados.length) return <EmptyState icon="historico" title="Nenhum registro encontrado"><p>Os acontecimentos registrados aparecerão aqui.</p></EmptyState>;
  return <ul className="list event-list">{ordenados.map(e => <li className="ev" key={e.id}>
    <span className="event-icon"><Icon nome={e.tipo} size={21} /></span>
    <time className="ev-d" dateTime={e.data}>{dataFormatada(e.data).slice(0, 5)}</time>
    <div className="ev-m">{mostrarLote && <strong>{lotes.find(l => l.id === e.loteId)?.nome || 'Lote não encontrado'}</strong>}<span>{descricao(e, pastos)}</span>{e.obs && <div className="sub">{e.obs}</div>}</div>
  </li>)}</ul>;
}

export default function Historico({ lotes, eventos, pastos }) {
  const [filtro, setFiltro] = useState('todos');
  return <><PageTitle icon="historico">Histórico</PageTitle><p className="sub subtitle">Acompanhe o que aconteceu no rebanho.</p><div className="chips page-list"><Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Chip>{lotes.map(l => <Chip key={l.id} ativo={filtro === l.id} onClick={() => setFiltro(l.id)}>{l.nome}</Chip>)}</div>
    <ListaEventos eventos={eventos.filter(e => filtro === 'todos' || e.loteId === filtro)} lotes={lotes} pastos={pastos} />
  </>;
}
