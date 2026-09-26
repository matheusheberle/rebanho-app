import Dexie from 'dexie';
import { normalizarLote } from './categorias.js';

// Banco local no aparelho. É nele que o app lê e grava no dia a dia,
// mesmo sem internet. A sincronização com o Supabase (nuvem) roda
// por cima disso, em sync.js, e nunca bloqueia uma gravação local.
export const db = new Dexie('rebanho');

db.version(1).stores({
  // "id" é sempre um uuid de texto, gerado no aparelho (crypto.randomUUID()),
  // para o mesmo registro ter o mesmo id local e na nuvem.
  pastos: 'id, nome',
  lotes: 'id, nome, categoria',
  eventos: 'id, loteId, tipo, data, pastoId, [loteId+data]',
  // fila de escrita: tudo que ainda não foi confirmado no Supabase
  fila_sync: '++seq, tabela, registroId, criadoEm'
});

// Migração aditiva: mantém lotes, pastos, eventos e a fila da versão 1.
db.version(2).stores({
  chuvas: 'id, data, mm',
  configuracoes: 'chave',
  clima_cache: 'chave'
});

export function novoId() {
  return crypto.randomUUID();
}

// Migração somente de conteúdo; preserva IDs, timestamps, fila e tombstones.
db.version(3).stores({ lotes: 'id, nome, categoria' }).upgrade(tx =>
  tx.table('lotes').toCollection().modify(lote => Object.assign(lote, normalizarLote(lote)))
);
