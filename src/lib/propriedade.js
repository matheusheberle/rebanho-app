import { db } from './db.js';
import { ESTADOS } from './estados.js';

export const CHAVE_PROPRIEDADE = 'localizacao'; // Reaproveita a configuração existente.
export const coordenadasValidas = (latitude, longitude) => Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
const texto = valor => typeof valor === 'string' ? valor.trim() : '';
const comparar = valor => texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function ufDoEstado(estado) {
  const valor = texto(estado).replace(/^BR-/i, '');
  return Object.keys(ESTADOS).find(uf => comparar(uf) === comparar(valor) || comparar(ESTADOS[uf]) === comparar(valor)) || null;
}

export function normalizarPropriedade(registro) {
  if (!registro || !coordenadasValidas(registro.latitude, registro.longitude)) return null;
  let uf = ufDoEstado(registro.uf), municipio = texto(registro.municipio);
  // Formato da busca antiga: "cidade, estado, Brasil". Não deduz UF por GPS ou cotação.
  const partes = texto(registro.nome).split(',').map(p => p.trim());
  if (!Object.hasOwn(registro, 'uf') && ['brasil', 'brazil'].includes(comparar(partes.at(-1))) && partes.length >= 3) {
    uf = ufDoEstado(partes.at(-2));
    if (uf) municipio ||= partes[0];
  }
  return { ...registro, municipio, uf, nome: texto(registro.nome) || 'Propriedade', atualizadoEm: registro.atualizadoEm || null };
}
export async function lerPropriedade() {
  return normalizarPropriedade(await db.configuracoes.get(CHAVE_PROPRIEDADE));
}

export async function salvarPropriedade(registro) {
  const nome = texto(registro.nome), municipio = texto(registro.municipio), uf = ufDoEstado(registro.uf);
  if (!nome || !coordenadasValidas(registro.latitude, registro.longitude)) throw new Error('Escolha uma localidade ou obtenha a localização antes de salvar.');
  if (registro.uf && !uf) throw new Error('Selecione uma UF válida.');
  const novo = { chave: CHAVE_PROPRIEDADE, nome, municipio, uf, latitude: registro.latitude, longitude: registro.longitude, atualizadoEm: new Date().toISOString() };
  await db.transaction('rw', db.configuracoes, db.clima_cache, async () => {
    const antiga = await lerPropriedade();
    if (!antiga || antiga.latitude !== novo.latitude || antiga.longitude !== novo.longitude) {
      // Uma volta à mesma coordenada pede nova previsão, sem mostrar outra cidade.
      await db.clima_cache.delete(`${novo.latitude},${novo.longitude}`);
    }
    await db.configuracoes.put(novo);
    // Marca o padrão sem copiar UF: a propriedade é a fonte de verdade.
    // Também impede que a migração da cotação reative uma preferência antiga.
    await db.configuracoes.put({ chave: 'cotacao:preferencia', origem: 'propriedade' });
  });
  return novo;
}

function posicaoUmaVez(signal) {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) return reject(new Error('A localização não está disponível neste navegador. Escolha manualmente.'));
    let concluido = false, timer;
    const terminar = (erro, valor) => {
      if (concluido) return;
      concluido = true; clearTimeout(timer); signal?.removeEventListener('abort', cancelar);
      erro ? reject(erro) : resolve(valor);
    };
    const cancelar = () => terminar(new DOMException('Consulta cancelada.', 'AbortError'));
    if (signal?.aborted) return cancelar();
    signal?.addEventListener('abort', cancelar, { once: true });
    const falhar = e => terminar(new Error(e?.code === 1 ? 'Não foi possível acessar sua localização. Permita o acesso no navegador ou escolha manualmente.' : e?.code === 3 ? 'A localização demorou demais. Tente novamente em um local aberto ou escolha manualmente.' : 'O GPS está indisponível. Tente novamente ou escolha manualmente.'));
    timer = setTimeout(() => falhar({ code: 3 }), 11000);
    try { navigator.geolocation.getCurrentPosition(p => terminar(null, p.coords), falhar, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }); }
    catch { falhar(); }
  });
}

// Somente chamada a partir do botão. Nunca recebe coordenadas armazenadas:
// o endpoint gratuito permite apenas a posição atual consentida do aparelho.
export async function obterLocalizacaoAtual({ signal } = {}) {
  const { latitude, longitude } = await posicaoUmaVez(signal);
  if (!coordenadasValidas(latitude, longitude)) throw new Error('O aparelho não informou uma localização válida. Escolha manualmente.');
  const base = { latitude, longitude, nome: 'Minha propriedade', municipio: '', uf: null };
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError');
  signal?.addEventListener('abort', cancelar, { once: true });
  let timer;
  try {
    if (navigator.onLine === false) throw new Error('Offline');
    const params = new URLSearchParams({ latitude, longitude, localityLanguage: 'pt' });
    const dados = await Promise.race([
      (async () => {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, { signal: controller.signal, credentials: 'omit' });
        if (!r.ok) throw new Error('Localidade indisponível');
        return r.json();
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, 8000); })
    ]);
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError');
    // Não aceitar resposta baseada em IP, outra coordenada ou UF estrangeira.
    if (!dados || !['coordinates', 'reverseGeocoding'].includes(dados.lookupSource) || Math.abs(dados.latitude - latitude) > .001 || Math.abs(dados.longitude - longitude) > .001 || !coordenadasValidas(dados.latitude, dados.longitude)) throw new Error('Resposta inesperada');
    const uf = dados.countryCode === 'BR' ? ufDoEstado(dados.principalSubdivisionCode) || ufDoEstado(dados.principalSubdivision) : null;
    const municipio = texto(dados.city) || texto(dados.locality);
    return { ...base, uf, municipio, nome: municipio ? `${municipio}${uf ? ` - ${uf}` : ''}` : base.nome,
      aviso: uf ? '' : 'Coordenadas obtidas. Não identificamos uma UF brasileira; selecione a UF se a propriedade fica no Brasil.' };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ...base, aviso: 'Coordenadas obtidas. Não foi possível identificar município e UF. Você pode confirmá-los abaixo, sem perder a posição obtida.' };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancelar); }
}
