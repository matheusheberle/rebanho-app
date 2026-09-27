import assert from 'node:assert/strict';

export async function testarRevisao({ evaluate, until, click, fill }) {
  // Cache disponível antes da rede terminar; cancelamento não dispara fetch.
  const clima = await evaluate(`(async () => {
    const { db } = await import('/src/lib/db.js');
    const { obterPrevisao } = await import('/src/lib/weather.js');
    const local = await db.configuracoes.get('localizacao');
    const original = window.fetch;
    let liberar, chamadas = 0, cacheAntes = false;
    window.fetch = async (...args) => {
      if (!String(args[0]).includes('/v1/forecast')) return original(...args);
      chamadas++; await new Promise(resolve => { liberar = resolve; });
      return new Response('{}', { status: 503 });
    };
    try {
      const pedido = obterPrevisao(local.latitude, local.longitude, { forcar:true, onCache: cache => { cacheAntes = cache.dias.length > 0; } });
      while (!liberar) await new Promise(r => setTimeout(r, 10));
      const antes = cacheAntes; liberar();
      const resultado = await pedido;
      const controller = new AbortController(); controller.abort();
      let cancelou = false;
      try { await obterPrevisao(local.latitude, local.longitude, { forcar:true, signal:controller.signal }); }
      catch (e) { cancelou = e.name === 'AbortError'; }
      return { antes, chamadas, cancelou, preservado:resultado.origem === 'cache' && resultado.desatualizada };
    } finally { window.fetch = original; }
  })()`);
  assert.deepEqual(clima, { antes:true, chamadas:1, cancelou:true, preservado:true });

  await evaluate(`window.__weatherRequests = []; document.dispatchEvent(new Event('visibilitychange'))`);
  await until(`!document.querySelector('.weather-refresh')?.disabled`);
  assert.equal(await evaluate('window.__weatherRequests.length'), 0, 'Retorno à aba respeita cache recente');

  // Fixture isolada, simulando chegada remota pelo Dexie.
  await evaluate(`(async () => {
    window.__envioLiberado = false;
    const { db } = await import('/src/lib/db.js');
    window.__reviewId = crypto.randomUUID();
    await db.lotes.put({ id:window.__reviewId, nome:'Lote revisão', categorias:['Bois'], criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString() });
  })()`);
  await click('Lotes');
  await until(`Array.from(document.querySelectorAll('.lote-row')).some(e => e.textContent.includes('Lote revisão'))`);
  await evaluate(`Array.from(document.querySelectorAll('.lote-row')).find(e => e.textContent.includes('Lote revisão')).click()`);
  await until(`Boolean(document.querySelector('.lote-summary'))`);
  await evaluate(`document.querySelector('[aria-label="Editar registro"]').click()`);
  await until(`Boolean(document.querySelector('#lote-nome'))`);
  await fill('lote-nome', 'Lote revisado');
  await evaluate(`(() => { const f = document.querySelector('form'); f.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true})); f.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true})); })()`);
  await until(`document.querySelector('.lote-summary h1')?.textContent === 'Lote revisado'`);
  assert.equal(await evaluate(`(async () => (await import('/src/lib/db.js')).db.fila_sync.where('registroId').equals(window.__reviewId).count())()`), 1, 'Uma edição para dois submits simultâneos');
  assert.match(await evaluate(`document.querySelector('.sync-status').textContent`), /pendente/);

  await click('Histórico');
  await click('Lote revisado');
  await evaluate(`(async () => (await import('/src/lib/db.js')).db.lotes.update(window.__reviewId, {excluidoEm:new Date().toISOString()}))()`);
  await until(`document.querySelector('main .chip[aria-pressed="true"]')?.textContent === 'Todos'`);
  await evaluate(`(async () => { const {db} = await import('/src/lib/db.js'); await db.lotes.delete(window.__reviewId); await db.fila_sync.where('registroId').equals(window.__reviewId).delete(); })()`);
  await click('Início');
  await until(`Boolean(document.querySelector('.weather-section'))`);
  for (const tema of ['light', 'dark']) {
    await evaluate(`document.documentElement.dataset.theme = '${tema}'`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.linkbtn, .back')).filter(e => e.getClientRects().length).every(e => e.getBoundingClientRect().height >= 44)`), true);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  }
  console.log('PASS revisão: cache imediato/cancelamento, retorno à aba, envio duplicado, pendências, filtro de lote excluído e controles de 44 px nos dois temas.');
}
