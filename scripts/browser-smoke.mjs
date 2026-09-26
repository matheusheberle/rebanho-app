// Teste local com perfil descartável e Supabase simulado; nunca acessa a nuvem.
// BROWSER_PATH pode apontar para outro navegador Chromium instalado.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { testarClimaEChuva } from './weather-smoke.mjs';
import { testarSincronizacao } from './sync-smoke.mjs';

const browserPath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile = await mkdtemp(join(tmpdir(), 'rebanho-smoke-'));
const server = await createServer({
  configFile: false, envFile: false,
  server: { host: '127.0.0.1', port: 5197, strictPort: true },
  plugins: [{
    name: 'supabase-simulado',
    enforce: 'pre',
    configureServer(vite) {
      vite.middlewares.use('/__migration', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><title>Teste isolado de migração</title>');
      });
    },
    transform(_code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/lib/supabase.js')) return;
      return `
        import { criarSupabaseMock } from '/scripts/supabase-mock.js';
        export const supabaseConfigurado = true;
        const mock = criarSupabaseMock({ permitir: () => Boolean(window.__envioLiberado) });
        window.__supabaseMock = mock;
        const rpcOriginal = mock.rpc;
        mock.rpc = (nome, args) => {
          const query = rpcOriginal(nome, args);
          return { async abortSignal(signal) {
            const resposta = await query.abortSignal(signal);
            if (!resposta.error) (window.__enviados ||= []).push({tabela:args.p_tabela,registro:args.p_registro});
            return resposta;
          } };
        };
        export const supabase = mock;
      `;
    }
  }, react()]
});
let browser;
let socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await server.listen();
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9337', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => console.error(error.message));
  let target;
  for (let i = 0; i < 60; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9337/json')).json()).find(t => t.type === 'page'); } catch {}
    if (target) break;
    await sleep(200);
  }
  assert.ok(target, 'Navegador iniciou');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') runtimeErrors.push(msg.params.exceptionDetails.text);
    if (pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
    }
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await sleep(100); }
    throw new Error(`Tempo esgotado: ${expression}`);
  };
  const click = async label => {
    await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b) throw new Error('Botão não encontrado'); b.click(); })()`);
    await sleep(120);
  };
  const fill = async (id, value) => {
    await evaluate(`(() => { const input = document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  };
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await command('Page.navigate', { url: 'http://127.0.0.1:5197/__migration' });
  await until(`document.title === 'Teste isolado de migração'`);
  const migracao = await evaluate(`(async () => {
    const {default: Dexie} = await import('/node_modules/dexie/dist/dexie.mjs');
    const antigo = new Dexie('rebanho');
    antigo.version(1).stores({pastos:'id, nome', lotes:'id, nome, categoria', eventos:'id, loteId, tipo, data, pastoId, [loteId+data]', fila_sync:'++seq, tabela, registroId, criadoEm'});
    await antigo.pastos.put({id:'migracao-pasto', nome:'Pasto existente'});
    await antigo.lotes.put({id:'migracao-lote', nome:'Lote existente', categoria:'Bois'});
    await antigo.eventos.put({id:'migracao-evento', loteId:'migracao-lote', pastoId:'migracao-pasto', tipo:'inicial', qtd:7, data:'2026-01-01'});
    await antigo.fila_sync.add({tabela:'lotes', registroId:'migracao-lote', criadoEm:'2026-01-01T00:00:00Z'});
    antigo.close();
    const {db} = await import('/src/lib/db.js');
    await db.open();
    const resultado = {versao:db.verno, nome:(await db.lotes.get('migracao-lote')).nome, qtd:(await db.eventos.get('migracao-evento')).qtd, pastos:await db.pastos.count(), fila:await db.fila_sync.count(), chuvas:await db.chuvas.count()};
    await db.transaction('rw', db.lotes, db.eventos, db.pastos, db.fila_sync, async () => {
      await db.lotes.clear(); await db.eventos.clear(); await db.pastos.clear(); await db.fila_sync.clear();
    });
    db.close();
    return resultado;
  })()`);
  assert.deepEqual(migracao, {versao:2, nome:'Lote existente', qtd:7, pastos:1, fila:1, chuvas:0});
  await command('Page.navigate', { url: 'http://127.0.0.1:5197' });
  await until(`document.body.textContent.includes('Criar primeiro lote')`);
  assert.equal(await evaluate(`document.querySelector('.tag-num').textContent`), '0');
  await click('Criar primeiro lote');
  await fill('lote-nome', 'Lote de teste');
  await fill('pasto-nome', 'Potreiro de teste');
  await fill('quantidade', '12');
  await click('Criar lote');
  await until(`document.querySelector('h1')?.textContent === 'Lote de teste'`);
  await click('Início');
  await until(`document.querySelector('.tag-num')?.textContent === '12'`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  assert.equal(await evaluate(`getComputedStyle(document.body).backgroundColor`), 'rgb(16, 24, 18)');
  await command('Page.reload');
  await until(`document.querySelector('.tag-num')?.textContent === '12'`);
  await click('Lotes');
  await evaluate(`document.querySelector('main .row').click()`);
  await sleep(150);
  await click('Pesar');
  await fill('peso', '340,5');
  await click('Salvar registro');
  await until(`document.querySelector('.stats')?.textContent.includes('340,5')`);
  await click('Vender');
  await fill('quantidade', '13');
  await click('Salvar registro');
  await until(`document.querySelector('.erro')?.textContent.includes('maior que o saldo')`);
  await fill('quantidade', '2');
  await click('Salvar registro');
  await until(`document.querySelector('.saldo')?.textContent === '10cabeças'`);
  await click('Histórico');
  assert.equal(await evaluate(`document.querySelectorAll('.ev').length`), 3);
  const fila = await evaluate(`(async () => { const {db} = await import('/src/lib/db.js'); return await db.fila_sync.count(); })()`);
  assert.equal(fila, 5, 'Pasto, lote e três eventos ficam na fila enquanto offline');
  await evaluate(`(async () => {
    const {db} = await import('/src/lib/db.js');
    const {salvarRegistro} = await import('/src/lib/sync.js');
    try { await db.transaction('rw', db.lotes, db.fila_sync, async () => {
      await salvarRegistro('lotes', {id:'rollback-test', nome:'Não persistir', categoria:'Bois'});
      throw new Error('rollback intencional');
    }); } catch {}
    if (await db.lotes.get('rollback-test')) throw new Error('Rollback falhou');
    if (await db.fila_sync.count() !== 5) throw new Error('Fila não reverteu');
    window.__envioLiberado = true;
    const {sincronizar} = await import('/src/lib/sync.js');
    await sincronizar();
  })()`);
  const enviados = await evaluate('window.__enviados');
  assert.equal(enviados.length, 5);
  assert.deepEqual(enviados.map(e => e.tabela), ['pastos', 'lotes', 'eventos', 'eventos', 'eventos']);
  for (const { registro } of enviados) {
    assert.ok(registro.criado_em);
    assert.ok(!('criadoEm' in registro || 'loteId' in registro || 'pastoId' in registro));
  }
  assert.ok(enviados[2].registro.lote_id && enviados[2].registro.pasto_id);
  assert.equal(await evaluate(`(async () => (await import('/src/lib/db.js')).db.fila_sync.count())()`), 0);
  await click('Início');
  await until(`document.querySelector('.tag-num')?.textContent === '10'`);
  await testarClimaEChuva({ command, evaluate, until, click, fill });
  await testarSincronizacao({ evaluate, until });
  assert.deepEqual(runtimeErrors, [], 'Sem exceções no navegador');
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(tmpdir(), 'rebanho-smoke.png'), Buffer.from(screenshot.data, 'base64'));
  console.log('PASS: vazio, cadastro, saldo, tema escuro, largura mobile, recarga, pesagem, validação de venda, histórico, fila offline, rollback e payload snake_case.');
  console.log(`Captura: ${join(tmpdir(), 'rebanho-smoke.png')}`);
} finally {
  socket?.close();
  browser?.kill();
  await server.close();
  await sleep(500);
  assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
  assert.ok(basename(profile).startsWith('rebanho-smoke-'));
  await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
