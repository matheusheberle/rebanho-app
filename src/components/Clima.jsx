import React, { useEffect, useState } from 'react';
import { dataNaLocalizacao, obterPrevisao } from '../lib/weather.js';
import { dataFormatada, numero } from '../lib/apresentacao.js';
import { Icon, SectionTitle } from './UI.jsx';
import { WeatherIcon } from './Icon.jsx';

function diaSemana(data) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

export default function Clima({ localizacao, navegar }) {
  const [estado, setEstado] = useState({ carregando: false, previsao: null });
  const [tentativa, setTentativa] = useState({ numero: 0, forcar: false });
  const latitude = localizacao?.latitude;
  const longitude = localizacao?.longitude;
  useEffect(() => {
    const atualizar = () => setTentativa(t => ({ numero: t.numero + 1, forcar: false }));
    const voltar = () => { if (document.visibilityState === 'visible') atualizar(); };
    window.addEventListener('online', atualizar);
    document.addEventListener('visibilitychange', voltar);
    return () => { window.removeEventListener('online', atualizar); document.removeEventListener('visibilitychange', voltar); };
  }, []);
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const controller = new AbortController();
    setEstado(anterior => ({ ...anterior, carregando: true }));
    obterPrevisao(latitude, longitude, { signal: controller.signal, forcar: tentativa.forcar,
      onCache: previsao => { if (!controller.signal.aborted) setEstado({ carregando: true, previsao }); } })
      .then(previsao => { if (!controller.signal.aborted) setEstado({ carregando: false, previsao }); })
      .catch(() => { if (!controller.signal.aborted) setEstado({ carregando: false, previsao: null }); });
    return () => controller.abort();
  }, [latitude, longitude, tentativa]);

  const { previsao, carregando } = estado;
  const hoje = previsao ? dataNaLocalizacao(previsao.timezone) : null;
  const proximos = previsao?.dias.filter(d => d.data >= hoje) || [];
  const vencida = Boolean(previsao && !proximos.length);
  const dias = (vencida ? previsao.dias : proximos).slice(0, 6);
  const chuvosos = dias.filter(d => d.chanceChuva >= 60);
  const temp = v => v == null ? '–' : `${numero(v)}°`;
  return <section aria-labelledby="clima-titulo" className="home-section surface weather-section">
    <SectionTitle id="clima-titulo" icon="clima">Previsão do tempo</SectionTitle>
    {!localizacao ? <p className="hint">Configure a localização da propriedade acima para consultar a previsão.</p> : <>
      <p className="hint location-caption"><Icon nome="localizacao" size={16} />{localizacao.nome}</p>
      <button className="linkbtn" onClick={() => navegar('localizacao')}>Alterar localização</button>
      {carregando && <p className="hint" role="status">Consultando clima…</p>}
      {!carregando && !previsao && <p className="hint" role="status">Clima indisponível</p>}
      {previsao && <>
        {!carregando && (previsao.desatualizada || vencida) && <p className="alert" role="status">{vencida ? 'Previsão salva de dias anteriores. Conecte-se para atualizar.' : 'Não foi possível atualizar. Exibindo a última previsão salva.'}</p>}
        <div className="clima" tabIndex={0} role="region" aria-label="Previsão diária; deslize para ver os próximos dias">{dias.map(d => <div className={`clima-d${d.data === hoje ? ' is-today' : ''}`} key={d.data}>
          <time className="cd-dia" dateTime={d.data}>{d.data === hoje ? 'Hoje' : diaSemana(d.data)}</time>
          {vencida && <span className="cd-data">{dataFormatada(d.data).slice(0, 5)}</span>}
          <WeatherIcon codigo={d.codigoTempo} />
          <span className="cd-temp" aria-label={`Máxima ${temp(d.maxima)}, mínima ${temp(d.minima)}`}>{temp(d.maxima)}<small>{temp(d.minima)}</small></span>
          <span className={`cd-chuva${d.chanceChuva >= 60 ? ' forte' : ''}`} aria-label={`Chance de chuva: ${d.chanceChuva == null ? 'indisponível' : `${d.chanceChuva}%`}`}><Icon nome="chuva" size={14} />{d.chanceChuva == null ? '–' : `${numero(d.chanceChuva)}%`}</span>
          <span className="cd-mm" aria-label={`Chuva prevista: ${d.chuvaPrevista == null ? 'indisponível' : `${numero(d.chuvaPrevista, 1)} milímetros`}`}>{d.chuvaPrevista == null ? '–' : `${numero(d.chuvaPrevista, 1)} mm`}</span>
        </div>)}</div>
        {!vencida && chuvosos.length > 0 && <p className="hint weather-note"><Icon nome="chuva" size={18} /><span>Alta chance de chuva em {chuvosos.length} {chuvosos.length === 1 ? 'dia' : 'dias'} ({chuvosos.map(d => d.data === hoje ? 'hoje' : diaSemana(d.data)).join(', ')}). Considere adiar manejos que dependam de tempo seco.</span></p>}
        <p className="hint weather-updated">{previsao.origem === 'cache' ? 'Previsão salva' : 'Atualizado'} em {new Date(previsao.atualizadoEm).toLocaleString('pt-BR')}. Valores previstos, não medidos.</p>
      </>}
      <button className="linkbtn weather-refresh" disabled={carregando} onClick={() => setTentativa(t => ({ numero: t.numero + 1, forcar: true }))}><Icon nome="atualizar" size={16} />Atualizar previsão</button>
    </>}
    <p className="hint weather-credit">Previsão: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
  </section>;
}
