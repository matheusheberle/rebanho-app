import Dexie from 'dexie';
import { TABELAS_SYNC, validarTabela, normalizarRegistro, versao, compararVersoes, paraSupabase, doSupabase, mesmoConteudo } from './sync-records.js';

// As dependências permitem testar dois aparelhos com bancos Dexie independentes.
export function criarSincronizador({ db, cliente, online = () => navigator.onLine, agora = () => Date.now(), tamanhoPagina = 500 }) {
  let emCurso = null;
  let repetir = false;
  let status = { estado: 'offline', erro: null, ultimaSincronizacao: null, conflitos: 0 };
  const ouvintes = new Set();
  const publicar = alteracao => {
    status = { ...status, ...alteracao };
    ouvintes.forEach(fn => fn());
  };
  const getSyncStatus = () => status;
  const subscribeSyncStatus = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };

  async function requisicao(construir) {
    if (!online()) throw new Error('Sem conexão.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error } = await construir().abortSignal(controller.signal);
      if (error) throw new Error(error.message || 'Falha ao sincronizar com o Supabase.');
      return data;
    } finally { clearTimeout(timer); }
  }

  function aposGravacao() {
    Dexie.ignoreTransaction(() => {
      if (emCurso) repetir = true;
      void sincronizarTudo();
    });
  }

  async function salvarRegistro(tabela, registro) {
    validarTabela(tabela);
    await db.transaction('rw', db.table(tabela), db.fila_sync, async () => {
      const anterior = await db.table(tabela).get(registro.id);
      const instante = new Date(agora()).toISOString();
      // Monotônico por registro, inclusive em edições no mesmo milissegundo.
      const atualizadoEm = new Date(Math.max(agora(), anterior ? versao(anterior) + 1 : 0)).toISOString();
      const criadoEm = anterior?.criadoEm || registro.criadoEm || instante;
      await db.table(tabela).put({ ...anterior, ...registro, criadoEm, atualizadoEm });
      await db.fila_sync.add({ tabela, registroId: registro.id, criadoEm: atualizadoEm });
    });
    // Uma transação externa pode agrupar pasto, lote e evento inicial.
    if (Dexie.currentTransaction) Dexie.currentTransaction.on('complete', aposGravacao);
    else aposGravacao();
  }

  async function aplicarRemotos(tabela, registros, confirmacao = null) {
    let conflitos = 0;
    await db.transaction('rw', db.table(tabela), db.fila_sync, async () => {
      const fila = await db.fila_sync.where('tabela').equals(tabela).toArray();
      const porId = new Map();
      for (const item of fila) {
        if (!porId.has(item.registroId)) porId.set(item.registroId, []);
        porId.get(item.registroId).push(item);
      }
      const locais = await db.table(tabela).bulkGet(registros.map(r => r.id));
      const gravar = [];
      const remover = new Set();
      registros.forEach((remoto, i) => {
        const local = locais[i];
        const pendencias = porId.get(remoto.id) || [];
        const comparacao = local ? compararVersoes(remoto, local, pendencias) : 1;
        // Empate pendente aguarda a RPC: só ela conhece o vencedor atômico.
        const aplicar = !local || comparacao > 0 || (comparacao === 0 && (!pendencias.length || confirmacao));
        if (aplicar) {
          if (local && pendencias.length && !mesmoConteudo(tabela, local, remoto)) conflitos++;
          if (!local || comparacao !== 0 || !mesmoConteudo(tabela, local, remoto)
            || !local.atualizadoEm || !local.criadoEm) gravar.push(remoto);
          pendencias.forEach(p => remover.add(p.seq));
        }
        if (confirmacao) {
          // A resposta confirma apenas o snapshot enviado, nunca edições feitas
          // durante o pedido de rede. Essas têm novas sequências na fila.
          pendencias.filter(p => confirmacao.sequencias.includes(p.seq)).forEach(p => remover.add(p.seq));
        }
      });
      if (gravar.length) await db.table(tabela).bulkPut(gravar);
      if (remover.size) await db.fila_sync.bulkDelete([...remover]);
    });
    if (conflitos) publicar({ conflitos: status.conflitos + conflitos });
  }

  async function enviarPendentes() {
    const fila = await db.fila_sync.toArray();
    // Pais antes dos eventos, mesmo quando a fila veio de uma versão antiga.
    for (const tabela of TABELAS_SYNC) {
      const ids = [...new Set(fila.filter(p => p.tabela === tabela).map(p => p.registroId))];
      for (const id of ids) {
        const snapshot = await db.transaction('rw', db.table(tabela), db.fila_sync, async () => {
          const pendencias = await db.fila_sync.where('registroId').equals(id).filter(p => p.tabela === tabela).toArray();
          if (!pendencias.length) return null;
          const local = await db.table(tabela).get(id);
          if (!local) throw new Error('Uma pendência não possui registro local. Nenhuma exclusão foi enviada.');
          const registro = normalizarRegistro(local, pendencias);
          if (!local.criadoEm || !local.atualizadoEm) await db.table(tabela).put(registro);
          return { registro, sequencias: pendencias.map(p => p.seq) };
        });
        if (!snapshot) continue;
        // A RPC faz INSERT ... ON CONFLICT ... WHERE atualizado_em > atual.
        // Um upsert comum ou um SELECT seguido de UPDATE perderia essa proteção.
        const vencedor = await requisicao(() => cliente.rpc('sincronizar_registro', {
          p_tabela: tabela, p_registro: paraSupabase(tabela, snapshot.registro)
        }));
        const remoto = doSupabase(tabela, vencedor);
        if (remoto.id !== id || compararVersoes(remoto, snapshot.registro) < 0) throw new Error('Confirmação remota inválida.');
        await aplicarRemotos(tabela, [remoto], snapshot);
      }
    }
    if (fila.some(p => !TABELAS_SYNC.includes(p.tabela))) throw new Error('A fila contém uma tabela não sincronizável.');
  }

  async function baixarDados() {
    for (const tabela of TABELAS_SYNC) {
      let ultimoId = null;
      for (;;) {
        const dados = await requisicao(() => {
          let query = cliente.from(tabela).select('*').order('id', { ascending: true }).limit(tamanhoPagina);
          if (ultimoId) query = query.gt('id', ultimoId);
          return query;
        });
        if (!Array.isArray(dados)) throw new Error('Resposta remota inválida.');
        if (!dados.length) break;
        const registros = dados.map(r => doSupabase(tabela, r));
        const proximoId = registros.at(-1).id;
        if (proximoId === ultimoId) throw new Error('Paginação remota não avançou.');
        await aplicarRemotos(tabela, registros);
        ultimoId = proximoId;
        // Só para em página vazia, inclusive se o servidor limitar a resposta
        // a menos registros que tamanhoPagina. Nada é apagado no Dexie.
      }
    }
  }

  async function executar() {
    publicar({ estado: 'sincronizando', erro: null, conflitos: 0 });
    do {
      repetir = false;
      let falha = null;
      try { await enviarPendentes(); } catch (error) { falha = error; }
      // Mesmo se um envio falhar, receber versões novas pode resolver conflitos.
      try { await baixarDados(); } catch (error) { falha ||= error; }
      if (falha) {
        publicar({ estado: online() ? 'erro' : 'offline', erro: online() ? falha.message : null });
        return;
      }
    } while (repetir && online());
    const pendentes = await db.fila_sync.count();
    publicar({ estado: !online() ? 'offline' : pendentes ? 'erro' : 'sincronizado',
      erro: pendentes && online() ? 'Ainda há alterações locais aguardando envio.' : null,
      ultimaSincronizacao: new Date(agora()).toISOString() });
  }

  function sincronizarTudo() {
    if (emCurso) return emCurso;
    if (!cliente || !online()) {
      publicar({ estado: 'offline', erro: null });
      return Promise.resolve();
    }
    // Promise compartilhada evita sobreposição mesmo em React StrictMode.
    emCurso = Promise.resolve().then(() => {
      if (globalThis.navigator?.locks) {
        return navigator.locks.request(`rebanho-sync:${db.name}`, executar);
      }
      return executar();
    }).catch(error => publicar({ estado: online() ? 'erro' : 'offline', erro: error.message }))
      .finally(() => {
        emCurso = null;
        // Uma gravação pode chegar entre o último download e a finalização.
        if (repetir && online()) { repetir = false; return sincronizarTudo(); }
      });
    return emCurso;
  }

  function marcarOffline() { publicar({ estado: 'offline', erro: null }); }
  return { salvarRegistro, sincronizarTudo, getSyncStatus, subscribeSyncStatus, marcarOffline };
}
