import { db } from './db.js';

const CAMPOS = [
  'temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max',
  'precipitation_sum', 'weather_code', 'wind_speed_10m_max'
];
const CACHE_MS = 60 * 60 * 1000;

export function coordenadasValidas(latitude, longitude) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

async function consultarJSON(url, signal) {
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancelar, { once: true });
  const timeout = setTimeout(cancelar, 10000);
  try {
    const resposta = await fetch(url, { signal: controller.signal });
    if (!resposta.ok) throw new Error('Não foi possível consultar a Open-Meteo.');
    const dados = await resposta.json();
    if (dados.error) throw new Error('Resposta indisponível da Open-Meteo.');
    return dados;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancelar);
  }
}

export async function buscarLocalidades(nome, { signal } = {}) {
  if (nome.trim().length < 2) return [];
  const params = new URLSearchParams({ name: nome.trim(), count: '8', language: 'pt', format: 'json' });
  const dados = await consultarJSON(`https://geocoding-api.open-meteo.com/v1/search?${params}`, signal);
  return (dados.results || []).filter(l => coordenadasValidas(l.latitude, l.longitude)).map(l => ({
    nome: [...new Set([l.name, l.admin1, l.country].filter(Boolean))].join(', '),
    latitude: l.latitude, longitude: l.longitude
  }));
}

// Configuração/cache são exclusivos deste aparelho e não entram na fila_sync.
export async function salvarLocalizacao({ nome, latitude, longitude }) {
  if (!nome.trim() || !coordenadasValidas(latitude, longitude)) throw new Error('Informe um nome e coordenadas válidas.');
  await db.configuracoes.put({ chave: 'localizacao', nome: nome.trim(), latitude, longitude });
}

export function dataNaLocalizacao(timezone, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora);
  const campo = nome => partes.find(p => p.type === nome).value;
  return `${campo('year')}-${campo('month')}-${campo('day')}`;
}

export async function obterPrevisao(latitude, longitude, { signal, forcar = false } = {}) {
  if (!coordenadasValidas(latitude, longitude)) throw new Error('Coordenadas inválidas.');
  // A chave impede que a previsão de uma fazenda seja exibida em outra.
  const chave = `${latitude},${longitude}`;
  const cache = await db.clima_cache.get(chave);
  const recente = cache && Date.now() - Date.parse(cache.atualizadoEm) < CACHE_MS
    && cache.dias.some(d => d.data === dataNaLocalizacao(cache.timezone));
  if (!forcar && recente) return { ...cache, origem: 'cache', desatualizada: false };
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Sem conexão.');
    const params = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude), daily: CAMPOS.join(','),
      timezone: 'auto', forecast_days: '7'
    });
    const dados = await consultarJSON(`https://api.open-meteo.com/v1/forecast?${params}`, signal);
    const diario = dados.daily;
    if (!diario?.time?.length || !dados.timezone || CAMPOS.some(c => !Array.isArray(diario[c]) || diario[c].length !== diario.time.length)) {
      throw new Error('Previsão incompleta.');
    }
    dataNaLocalizacao(dados.timezone); // valida o fuso antes de persistir
    const valor = v => Number.isFinite(v) ? v : null;
    const previsao = {
      chave, latitude, longitude, timezone: dados.timezone, atualizadoEm: new Date().toISOString(),
      dias: diario.time.map((data, i) => ({
        data, maxima: valor(diario.temperature_2m_max[i]), minima: valor(diario.temperature_2m_min[i]),
        chanceChuva: valor(diario.precipitation_probability_max[i]), chuvaPrevista: valor(diario.precipitation_sum[i]),
        codigoTempo: valor(diario.weather_code[i]), ventoMaximo: valor(diario.wind_speed_10m_max[i])
      }))
    };
    await db.clima_cache.put(previsao);
    return { ...previsao, origem: 'rede', desatualizada: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (cache) return { ...cache, origem: 'cache', desatualizada: true };
    throw error;
  }
}
