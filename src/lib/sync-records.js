import { normalizarLote } from './categorias.js';
export const TABELAS_SYNC = ['pastos', 'lotes', 'eventos', 'chuvas'];
const BASE = ['id', 'criadoEm', 'atualizadoEm', 'excluidoEm'];
const CAMPOS = {
  pastos: [...BASE, 'nome'],
  lotes: [...BASE, 'nome', 'categoria', 'categorias'],
  eventos: [...BASE, 'loteId', 'tipo', 'data', 'qtd', 'peso', 'produto', 'carencia', 'pastoId', 'fim', 'obs'],
  chuvas: [...BASE, 'data', 'mm', 'obs']
};
const NOMES = { excluidoEm: 'excluido_em', loteId: 'lote_id', pastoId: 'pasto_id', criadoEm: 'criado_em', atualizadoEm: 'atualizado_em' };
const EPOCA = '1970-01-01T00:00:00.000Z';

export function validarTabela(tabela) {
  if (!TABELAS_SYNC.includes(tabela)) throw new Error(`Tabela não sincronizada: ${tabela}`);
}

function dataValida(data) {
  return typeof data === 'string' && Number.isFinite(Date.parse(data));
}

export function normalizarRegistro(registro, pendencias = []) {
  // Para dados antigos, a última entrada na fila representa a última edição.
  // Nunca usar "agora" no download ou na migração: isso fabricaria uma versão nova.
  const fila = pendencias.map(p => p.criadoEm).filter(dataValida).sort((a, b) => Date.parse(b) - Date.parse(a));
  const criadoEm = dataValida(registro.criadoEm) ? registro.criadoEm : fila.at(-1) || EPOCA;
  const atualizadoEm = dataValida(registro.atualizadoEm) ? registro.atualizadoEm : fila[0] || criadoEm;
  return { ...registro, criadoEm, atualizadoEm };
}

export function versao(registro, pendencias) {
  return Date.parse(normalizarRegistro(registro, pendencias).atualizadoEm);
}

export function compararVersoes(a, b, pendenciasB) {
  const micros = (registro, pendencias) => {
    const data = normalizarRegistro(registro, pendencias).atualizadoEm;
    const fracao = (data.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0');
    // PostgreSQL mantém microssegundos; Date.parse sozinho os truncaria.
    return BigInt(Date.parse(data)) * 1000n + BigInt(fracao.slice(3, 6));
  };
  const esquerda = micros(a), direita = micros(b, pendenciasB);
  return esquerda > direita ? 1 : esquerda < direita ? -1 : 0;
}

export function paraSupabase(tabela, registro) {
  validarTabela(tabela);
  const normalizado = normalizarRegistro(tabela === 'lotes' ? normalizarLote(registro) : registro);
  return Object.fromEntries(CAMPOS[tabela].map(campo => [NOMES[campo] || campo, normalizado[campo] ?? null]));
}

export function doSupabase(tabela, registro) {
  validarTabela(tabela);
  if (!registro || typeof registro.id !== 'string') throw new Error('Registro remoto inválido.');
  const local = Object.fromEntries(CAMPOS[tabela].map(campo => [campo, registro[NOMES[campo] || campo] ?? null]));
  return normalizarRegistro(tabela === 'lotes' ? normalizarLote(local) : local);
}

export function mesmoConteudo(tabela, a, b) {
  if (tabela === 'lotes') { a = normalizarLote(a); b = normalizarLote(b); }
  return CAMPOS[tabela].filter(c => c !== 'criadoEm' && c !== 'atualizadoEm')
    .every(c => c === 'categorias' ? JSON.stringify(a[c]) === JSON.stringify(b[c]) : (a[c] ?? null) === (b[c] ?? null));
}
