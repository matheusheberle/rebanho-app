import React from 'react';
import { EmptyState, Icon, LinhaLote, PageTitle, SectionTitle } from '../components/UI.jsx';
import { pastoAtualDoLote, saldoDoLote } from '../lib/calc.js';
import { numero } from '../lib/apresentacao.js';
export default function Lotes({ lotes, eventos, pastos: ativos, pastosHistorico = ativos, navegar }) {
  const pastos = pastosHistorico;
  const linhas = lotes.map(lote => ({ lote, saldo: saldoDoLote(lote.id, eventos), pastoId: pastoAtualDoLote(lote.id, eventos) }));
  return <>
    <div className="head"><PageTitle icon="lotes">Lotes</PageTitle><button className="btn ghost sm" onClick={() => navegar('novoLote')}><Icon nome="novoLote" size={19} />Novo lote</button></div>
    <p className="sub subtitle">Saldo, potreiro e peso de cada lote.</p>
    <section className="home-section" aria-labelledby="todos-lotes-titulo"><SectionTitle id="todos-lotes-titulo" icon="lotes">Todos os lotes</SectionTitle>
    {lotes.length ? <ul className="list">{lotes.map(lote => <li key={lote.id}><LinhaLote lote={lote} eventos={eventos} pastos={pastos} onClick={() => navegar('lote', lote.id)} /></li>)}</ul>
      : <EmptyState icon="lotes" title="Nenhum lote cadastrado"><p>Toque em Novo lote para começar.</p></EmptyState>}
    </section>
    <section className="home-section pasture-groups" aria-labelledby="por-potreiro-titulo">
      <SectionTitle id="por-potreiro-titulo" icon="pastos">Por potreiro</SectionTitle>
      {ativos.length ? <ul className="list">{ativos.map(p => {
        const ocupantes = linhas.filter(l => l.pastoId === p.id);
        const cabecas = ocupantes.reduce((soma, l) => soma + l.saldo, 0);
        return <li key={p.id} data-pasto-id={p.id}><div className="row"><div className="row-main">
          <strong>{p.nome}</strong>
          <span>{ocupantes.length ? ocupantes.map(l => l.lote.nome).join(' · ') : 'Nenhum lote neste potreiro.'}</span>
          <span>{numero(ocupantes.length)} {ocupantes.length === 1 ? 'lote' : 'lotes'} · {numero(cabecas)} {cabecas === 1 ? 'cabeça' : 'cabeças'}</span>
        </div></div></li>;
      })}</ul> : <p className="hint">Nenhum potreiro cadastrado. Cadastre em Pastos e potreiros.</p>}
      <button className="btn ghost section-action" onClick={() => navegar('pastos')}><Icon nome="pastos" />Pastos e potreiros</button>
    </section>
  </>;
}
