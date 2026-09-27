import React from 'react';
import { saldoDoLote, pastoAtualDoLote, calcularAlertas } from '../lib/calc.js';
import { hojeISO, numero } from '../lib/apresentacao.js';
import { categoriasDoLote } from '../lib/categorias.js';
import { totaisDeChuva } from '../lib/chuva.js';
import Clima from '../components/Clima.jsx';
import { Settings } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LeiturasChuva from '../components/LeiturasChuva.jsx';
import CotacaoArroba from '../components/CotacaoArroba.jsx';
import { EmptyState, Icon, SectionTitle } from '../components/UI.jsx';
export default function Home({ lotes, eventos, pastos, chuvas, localizacao, navegar, avisar }) {
  const contagens = new Map();
  chuvas.forEach(r => contagens.set(r.data, (contagens.get(r.data) || 0) + 1));
  const duplicadas = chuvas.filter(r => contagens.get(r.data) > 1);
  const chuva = totaisDeChuva(chuvas.filter(r => contagens.get(r.data) === 1), hojeISO());
  const linhas = lotes.map(lote => ({ lote, saldo: saldoDoLote(lote.id, eventos), pastoId: pastoAtualDoLote(lote.id, eventos) }));
  const total = linhas.reduce((soma, linha) => soma + linha.saldo, 0);
  const categorias = [...new Set(linhas.filter(x => x.saldo > 0).flatMap(x => categoriasDoLote(x.lote)))];
  const alertas = calcularAlertas(lotes, eventos, hojeISO());
  return <>
    <div className="home-heading"><h1>Rebanho hoje</h1><div className="home-tools"><ThemeToggle /><button className="settings-toggle" aria-label="Configurações" title="Configurações" onClick={() => navegar('configuracoes')}><Settings size={21} aria-hidden="true" /></button></div></div>
    <p className="sub subtitle">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div className="tag" role="group" aria-label={`Total do rebanho: ${total} cabeças`}>
      <div className="tag-num">{numero(total)}</div><div className="tag-lbl">cabeças no rebanho</div>
    </div>
    <section aria-label="Categorias do rebanho" className="herd-categories"><SectionTitle icon="categoria">Categorias do rebanho</SectionTitle>{categorias.length ? <ul className="chips category-badges">{categorias.map(c => <li className="chip" key={c}>{c}</li>)}</ul> : <p className="hint">Nenhuma categoria nos lotes ativos com saldo.</p>}<p className="hint">Sem divisão de cabeças por categoria.</p></section>
    {lotes.length === 0 && <EmptyState icon="lotes" title="Seu rebanho começa aqui"><p>Nenhum lote cadastrado ainda. Crie o primeiro lote para acompanhar seu rebanho.</p><button className="btn" onClick={() => navegar('novoLote')}><Icon nome="novoLote" />Criar primeiro lote</button></EmptyState>}
    {alertas.length > 0 && <section className="home-section alerts-section"><SectionTitle icon="alerta">Precisa de atenção</SectionTitle>{alertas.map((a, i) => <button className="alert alert-row" key={`${a.loteId}-${i}`} onClick={() => navegar('lote', a.loteId)}><Icon nome="alerta" /><span>{a.texto}</span><Icon nome="chev" /></button>)}</section>}
    <Clima key={`${localizacao?.latitude},${localizacao?.longitude},${localizacao?.atualizadoEm}`} localizacao={localizacao} navegar={navegar} />
    <section aria-labelledby="chuva-titulo" className="home-section surface rain-section"><SectionTitle id="chuva-titulo" icon="chuva">Chuva na fazenda</SectionTitle>
      <p className="hint">Medições do pluviômetro da propriedade.</p>
      {duplicadas.length > 0 && <p className="erro" role="status">Há datas com leituras duplicadas. Os totais são parciais e não incluem essas datas. Abra “Ver e corrigir leituras” para escolher qual manter; os valores foram preservados.</p>}
      <dl className="stats rain-stats">{[['hoje', 'Hoje'], ['semana', 'Últimos 7 dias'], ['mes', 'Últimos 30 dias']].map(([chave, titulo]) => <div key={chave}><dt>{titulo}</dt><dd data-total-chuva={chave}>{chuva[chave].toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span>mm</span></dd></div>)}</dl>
      <p className="hint">Totais das leituras registradas, incluindo hoje. Dias sem leitura não confirmam ausência de chuva.</p>
      <button className="btn section-action" onClick={() => navegar('registrarChuva')}><Icon nome="chuva" />Registrar chuva</button>
      <LeiturasChuva chuvas={chuvas} navegar={navegar} avisar={avisar} />
    </section>
    <CotacaoArroba navegar={navegar} />
    <section className="home-section"><SectionTitle icon="pastos">Por potreiro</SectionTitle><button className="btn ghost section-action" onClick={() => navegar('pastos')}><Icon nome="pastos" />Pastos e potreiros</button>
      {pastos.length === 0 ? <p className="hint">Os potreiros aparecerão aqui ao cadastrar seus lotes.</p> : <ul className="list">{pastos.map(p => {
        const ocupantes = linhas.filter(x => x.saldo > 0 && x.pastoId === p.id);
        return <li key={p.id}><div className="row"><span className="row-n">{numero(ocupantes.reduce((soma, x) => soma + x.saldo, 0))}</span><span className="row-main"><strong>{p.nome}</strong><span>{ocupantes.length ? ocupantes.map(x => x.lote.nome).join(', ') : 'Sem gado agora'}</span></span></div></li>;
      })}</ul>}
    </section>
  </>;
}
