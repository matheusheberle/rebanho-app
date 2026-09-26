import React from 'react';
import { EmptyState, Icon, LinhaLote, PageTitle } from '../components/UI.jsx';
export default function Lotes({ lotes, eventos, pastos: ativos, pastosHistorico = ativos, navegar }) {
  const pastos = pastosHistorico;
  return <>
    <div className="head"><PageTitle icon="lotes">Lotes</PageTitle><button className="btn ghost sm" onClick={() => navegar('novoLote')}><Icon nome="novoLote" size={19} />Novo lote</button></div>
    <p className="sub subtitle">Saldo, potreiro e peso de cada lote.</p>
    {lotes.length ? <ul className="list page-list">{lotes.map(lote => <li key={lote.id}><LinhaLote lote={lote} eventos={eventos} pastos={pastos} onClick={() => navegar('lote', lote.id)} /></li>)}</ul>
      : <EmptyState icon="lotes" title="Nenhum lote cadastrado"><p>Toque em Novo lote para começar.</p></EmptyState>}
  </>;
}
