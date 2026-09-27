import { liveQuery } from 'dexie';
import { db } from './db.js';
import { hojeISO } from './apresentacao.js';

import { ESTADOS } from './estados.js';
export { ESTADOS } from './estados.js';
import { lerPropriedade } from './propriedade.js';
export const ENDPOINT_COTACAO = 'https://agrodocai.com.br/api/v1/cotacao';
export const CACHE_COTACAO_MS = 6 * 60 * 60 * 1000;
const PREFERENCIA = 'cotacao:preferencia';
const LIMITE = 'cotacao:agrodoc:limites';
const chave = (tipo, uf) => `cotacao:${tipo}:${uf}`;
const emCurso = new Map();
let fila = Promise.resolve();
const online = () => globalThis.navigator?.onLine !== false;
const erro = (codigo, mensagem, extras = {}) => Object.assign(new Error(mensagem), { codigo, ...extras });
function validarUF(uf) {
  if (!Object.hasOwn(ESTADOS, uf)) throw erro('uf', 'Escolha um estado válido.');
  return uf;
}
function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const d = new Date(`${data}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === data;
}

export function interpretarCotacao(resposta, uf) {
  validarUF(uf);
  if (!resposta || typeof resposta !== 'object' || Array.isArray(resposta)) throw erro('formato', 'Resposta de cotação inesperada.');
  const agregada = Object.hasOwn(resposta, 'boi_gordo_uf') || Object.hasOwn(resposta, 'boi_gordo_cepea_sp');
  const regional = agregada ? resposta.boi_gordo_uf : resposta;
  if (!regional || typeof regional !== 'object' || Array.isArray(regional)) throw erro('sem_dado', 'Não há cotação disponível para este estado.');
  if (regional.uf !== uf) throw erro('sem_dado', 'A fonte não retornou cotação para o estado escolhido.');
  if ((!agregada && regional.produto !== 'boi_gordo') || (regional.produto && regional.produto !== 'boi_gordo')) throw erro('formato', 'Produto inesperado na resposta.');
  if ((!agregada && (regional.moeda !== 'BRL' || regional.unidade !== '@')) || (regional.moeda && regional.moeda !== 'BRL') || (regional.unidade && regional.unidade !== '@')) throw erro('formato', 'Unidade ou moeda inesperada.');
  const bruto = agregada ? regional.preco : regional.valor;
  const valor = typeof bruto === 'number' ? bruto : typeof bruto === 'string' && /^\d+(\.\d+)?$/.test(bruto) ? Number(bruto) : NaN;
  if (!Number.isFinite(valor) || valor <= 0 || valor * 100 > Number.MAX_SAFE_INTEGER) throw erro('sem_dado', 'Preço regional indisponível.');
  const fonte = regional.fonte || resposta.fonte;
  if (typeof fonte !== 'string' || !fonte.trim()) throw erro('formato', 'A resposta não identificou a fonte.');
  const dataOriginal = regional.data_cotacao || resposta.data_cotacao;
  const atualizacao = regional.atualizado || resposta.atualizado;
  const dataCotacao = dataOriginal || (typeof atualizacao === 'string' && Number.isFinite(Date.parse(atualizacao)) ? atualizacao.slice(0,10) : null);
  if (!dataValida(dataCotacao)) throw erro('formato', 'Data da fonte indisponível ou inválida.');
  return { uf, valor, moeda:'BRL', unidade:'@', dataCotacao, dataEhAtualizacao:!dataOriginal,
    fonte:fonte.trim(), praca:typeof regional.praca === 'string' ? regional.praca : null,
    modo:'automatico', provedor:'agrodoc', variacao:null,
    // Os formatos documentados não garantem percentual regional comparável.
    atualizadoNaFonte:atualizacao || null, licenca:resposta.license || null };
}

export async function buscarCotacaoArroba(uf, { fetchImpl = globalThis.fetch, timeoutMs = 9000, agora = Date.now() } = {}) {
  validarUF(uf);
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const r = await fetchImpl(`${ENDPOINT_COTACAO}?uf=${encodeURIComponent(uf)}`, { headers:{Accept:'application/json'}, signal:controller.signal, credentials:'omit' });
        if (r.status === 429) {
          const retry = r.headers.get('Retry-After');
          const indicado = retry && /^\d+$/.test(retry) ? agora + Number(retry)*1000 : Date.parse(retry || '');
          throw erro('limite', 'Limite temporário da fonte. Tente novamente mais tarde.', { tentarApos:Math.max(agora+60000, Number.isFinite(indicado) ? indicado : agora+CACHE_COTACAO_MS) });
        }
        if (!r.ok) throw erro('http', 'Não foi possível atualizar a cotação agora.');
        let json;
        try { json = await r.json(); } catch { throw erro('json', 'A fonte retornou uma resposta inválida.'); }
        return interpretarCotacao(json, uf);
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(erro('timeout', 'A consulta demorou demais. Tente novamente mais tarde.')); }, timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

export async function salvarPreferenciaCotacao(uf) {
  validarUF(uf);
  const preferencia = { uf, nome:ESTADOS[uf], origem: 'manual' };
  await db.configuracoes.put({ chave:PREFERENCIA, ...preferencia });
  return preferencia;
}

export async function usarUFDaPropriedade() {
  await db.configuracoes.put({ chave: PREFERENCIA, origem: 'propriedade' });
}

async function referenciaCotacao() {
  const propriedade = await lerPropriedade();
  const manual = await db.configuracoes.get(PREFERENCIA);
  if (manual?.origem === 'manual' && Object.hasOwn(ESTADOS, manual.uf)) return { propriedade, preferencia: manual };
  if (propriedade?.uf) return { propriedade, preferencia: { uf: propriedade.uf, nome: ESTADOS[propriedade.uf], origem: 'propriedade' } };
  return { propriedade, preferencia: manual && Object.hasOwn(ESTADOS, manual.uf) ? manual : null };
}

async function migrarPreferenciaLegada() {
  await db.transaction('rw', db.configuracoes, async () => {
    if (await db.configuracoes.get(PREFERENCIA)) return;
    const antiga = await db.configuracoes.get('cotacao:praca');
    if (!antiga || !Object.hasOwn(ESTADOS, antiga.uf)) return;
    await db.configuracoes.put({ chave:PREFERENCIA, uf:antiga.uf, nome:ESTADOS[antiga.uf] });
    const manual = await db.configuracoes.get(`cotacao:cache:${antiga.fonte}:${antiga.id}`);
    if (manual?.valor > 0 && dataValida(manual.data)) {
      await db.configuracoes.put({ chave:chave('manual',antiga.uf), uf:antiga.uf, valor:manual.valor, dataCotacao:manual.data,
        fonte:manual.fonteInformada || 'Usuário', modo:'manual', variacao:null, referenciaLegada:antiga.regiao,
        atualizadoLocalmenteEm:manual.atualizadoEm });
      await db.configuracoes.put({ chave:chave('estado',antiga.uf), modo:'manual' });
    }
    // As chaves antigas permanecem intactas, sem reclassificar preço manual.
  });
}

export async function obterCotacaoEmCache(uf) {
  validarUF(uf);
  const [automatico, manual, estado] = await Promise.all(['automatico','manual','estado'].map(tipo => db.configuracoes.get(chave(tipo,uf))));
  return { cotacao:(estado?.modo === 'manual' ? manual || automatico : automatico || manual) || null, automatico:automatico || null, estado:estado || {} };
}
export async function lerCotacaoSelecionada() {
  return db.transaction('r', db.configuracoes, async () => {
    const { propriedade, preferencia } = await referenciaCotacao();
    return preferencia ? { propriedade, preferencia, ...await obterCotacaoEmCache(preferencia.uf) } : { propriedade, preferencia:null, cotacao:null, estado:{} };
  });
}
export const observarCotacao = ouvinte => liveQuery(lerCotacaoSelecionada).subscribe(ouvinte);

export async function carregarCotacaoArroba({ forcar = false, agora = Date.now(), fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  await migrarPreferenciaLegada();
  const { preferencia } = await lerCotacaoSelecionada();
  if (!preferencia) return;
  const uf = preferencia.uf;
  if (emCurso.has(uf)) return emCurso.get(uf);
  async function consultar() {
    const { automatico, estado } = await obterCotacaoEmCache(uf);
    if (!online()) return;
    const idade = agora - Date.parse(automatico?.atualizadoLocalmenteEm);
    if (!forcar && idade >= 0 && idade < CACHE_COTACAO_MS && estado.modo !== 'manual' && !estado.erro) return;
    const limites = await db.configuracoes.get(LIMITE) || {};
    if (limites.tentarApos > agora) {
      await db.configuracoes.put({ ...estado, chave:chave('estado',uf), tentarApos:limites.tentarApos, codigo:'limite', erro:'Limite temporário da fonte. Tente novamente mais tarde.' });
      return;
    }
    if (estado.tentarApos > agora || estado.ultimaTentativa > agora - 60000) return;
    const dia = new Date(agora).toISOString().slice(0,10);
    const pedidos = limites.dia === dia ? limites.pedidos || 0 : 0;
    if (pedidos >= 80) {
      await db.configuracoes.put({ ...estado, chave:chave('estado',uf), erro:'Limite local de consultas do dia. Tente amanhã.', codigo:'limite' }); return;
    }
    await db.configuracoes.put({ ...limites, chave:LIMITE, dia, pedidos:pedidos+1 });
    await db.configuracoes.put({ ...estado, chave:chave('estado',uf), ultimaTentativa:agora });
    try {
      const cotacao = await buscarCotacaoArroba(uf, {fetchImpl,timeoutMs,agora});
      await db.transaction('rw', db.configuracoes, async () => {
        await db.configuracoes.put({ ...cotacao, chave:chave('automatico',uf), atualizadoLocalmenteEm:new Date(agora).toISOString() });
        await db.configuracoes.put({ chave:chave('estado',uf), ultimaTentativa:agora, modo:'automatico', erro:null });
      });
    } catch (e) {
      const tentarApos = e.tentarApos || agora+15*60000;
      await db.configuracoes.put({ ...estado, chave:chave('estado',uf), ultimaTentativa:agora, tentarApos, erro:e.message || 'Fonte indisponível.', codigo:e.codigo || 'rede' });
      if (e.codigo === 'limite') await db.configuracoes.put({ ...limites, chave:LIMITE, dia, pedidos:pedidos+1, tentarApos });
    }
  }
  // Entre componentes e abas quando Web Locks estiver disponível. Sem polling.
  const executar = () => globalThis.navigator?.locks ? navigator.locks.request('rebanho-cotacao-agrodoc', consultar) : consultar();
  const promessa = fila.catch(() => {}).then(executar).finally(() => emCurso.delete(uf));
  fila = promessa; emCurso.set(uf,promessa);
  return promessa;
}

export async function salvarCotacaoManual(uf, { valor, data = hojeISO() }) {
  validarUF(uf);
  const texto = String(valor ?? '').trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto) || Number(texto.replace(',','.')) <= 0 || Number(texto.replace(',','.'))*100 > Number.MAX_SAFE_INTEGER) throw erro('valor','Informe um valor positivo em R$/@, com até duas casas decimais.');
  if (!dataValida(data) || data > hojeISO()) throw erro('data','Informe uma data válida, até hoje.');
  await db.transaction('rw', db.configuracoes, async () => {
    const estado = await db.configuracoes.get(chave('estado',uf)) || {};
    if (online() && !estado.erro) throw erro('manual','A consulta automática está disponível. Use Atualizar na Home.');
    if ((await referenciaCotacao()).preferencia?.uf !== uf) throw erro('uf','A região foi alterada. Abra o formulário novamente.');
    await db.configuracoes.put({ chave:chave('manual',uf), uf, valor:Number(texto.replace(',','.')), dataCotacao:data,
      fonte:'Usuário', modo:'manual', variacao:null, atualizadoLocalmenteEm:new Date().toISOString() });
    await db.configuracoes.put({ ...estado, chave:chave('estado',uf), modo:'manual' });
  });
}
