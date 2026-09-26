import React from 'react';
import { saldoDoLote, pastoAtualDoLote, calcularAlertas } from '../lib/calc.js';
import { CATEGORIAS, CORES, hojeISO, numero } from '../lib/apresentacao.js';
import { totaisDeChuva } from '../lib/chuva.js';
import Clima from '../components/Clima.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { EmptyState, Icon, SectionTitle } from '../components/UI.jsx';
export default function Home({ lotes, eventos, pastos, chuvas, localizacao, navegar }) {
  const chuva = totaisDeChuva(chuvas, hojeISO());
  const linhas = lotes.map(lote => ({ lote, saldo: saldoDoLote(lote.id, eventos), pastoId: pastoAtualDoLote(lote.id, eventos) }));
  const total = linhas.reduce((soma, linha) => soma + linha.saldo, 0);
  const categorias = [...new Set([...CATEGORIAS, ...lotes.map(l => l.categoria)])]
    .map(nome => ({ nome, saldo: linhas.filter(x => x.lote.categoria === nome).reduce((soma, x) => soma + x.saldo, 0) }))
    .filter(c => c.saldo > 0);
  const alertas = calcularAlertas(lotes, eventos, hojeISO());
  return <>
    <div className="home-heading"><h1>Rebanho hoje</h1><ThemeToggle /></div>
    <p className="sub subtitle">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div className="tag" role="group" aria-label={`Total do rebanho: ${total} cabeças`}>
      <div className="tag-num">{numero(total)}</div><div className="tag-lbl">cabeças no rebanho</div>
    </div>
    {total > 0 && <><div className="bar" aria-hidden="true">{categorias.map(c => <span key={c.nome} style={{ width: `${c.saldo / total * 100}%`, background: CORES[c.nome] || 'var(--muted)' }} />)}</div>
      <ul className="leg">{categorias.map(c => <li key={c.nome}><i style={{ background: CORES[c.nome] || 'var(--muted)' }} />{c.nome}<b>{numero(c.saldo)}</b></li>)}</ul></>}
    {lotes.length === 0 && <EmptyState icon="lotes" title="Seu rebanho começa aqui"><p>Nenhum lote cadastrado ainda. Crie o primeiro lote para acompanhar seu rebanho.</p><button className="btn" onClick={() => navegar('novoLote')}><Icon nome="novoLote" />Criar primeiro lote</button></EmptyState>}
    {alertas.length > 0 && <section className="home-section alerts-section"><SectionTitle icon="alerta">Precisa de atenção</SectionTitle>{alertas.map((a, i) => <button className="alert alert-row" key={`${a.loteId}-${i}`} onClick={() => navegar('lote', a.loteId)}><Icon nome="alerta" /><span>{a.texto}</span><Icon nome="chev" /></button>)}</section>}
    <Clima key={`${localizacao?.latitude},${localizacao?.longitude}`} localizacao={localizacao} navegar={navegar} />
    <section aria-labelledby="chuva-titulo" className="home-section surface rain-section"><SectionTitle id="chuva-titulo" icon="chuva">Chuva na fazenda</SectionTitle>
      <p className="hint">Medições do pluviômetro da propriedade.</p>
      <dl className="stats rain-stats">{[['hoje', 'Hoje'], ['semana', 'Últimos 7 dias'], ['mes', 'Últimos 30 dias']].map(([chave, titulo]) => <div key={chave}><dt>{titulo}</dt><dd data-total-chuva={chave}>{chuva[chave].toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span>mm</span></dd></div>)}</dl>
      <p className="hint">Totais das leituras registradas, incluindo hoje. Dias sem leitura não confirmam ausência de chuva.</p>
      <button className="btn section-action" onClick={() => navegar('registrarChuva')}><Icon nome="chuva" />Registrar chuva</button>
    </section>
    <section className="home-section quiet-section"><SectionTitle icon="venda">Arroba do boi (CEPEA)</SectionTitle><p className="hint">Cotação indisponível. Nenhuma fonte de atualização conectada.</p></section>
    <section className="home-section"><SectionTitle icon="lotes">Por potreiro</SectionTitle>
      {pastos.length === 0 ? <p className="hint">Os potreiros aparecerão aqui ao cadastrar seus lotes.</p> : <ul className="list">{pastos.map(p => {
        const ocupantes = linhas.filter(x => x.saldo > 0 && x.pastoId === p.id);
        return <li key={p.id}><div className="row"><span className="row-n">{numero(ocupantes.reduce((soma, x) => soma + x.saldo, 0))}</span><span className="row-main"><strong>{p.nome}</strong><span>{ocupantes.length ? ocupantes.map(x => x.lote.nome).join(', ') : 'Sem gado agora'}</span></span></div></li>;
      })}</ul>}
    </section>
  </>;
}
