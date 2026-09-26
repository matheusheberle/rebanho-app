import assert from 'node:assert/strict';

// Rede simulada apenas no perfil descartável do teste; nenhum dado real é enviado.
function simularOpenMeteo() {
  const original = window.fetch.bind(window);
  window.__weatherRequests = [];
  window.fetch = async (input, options) => {
    const url = String(input);
    if (!url.includes('open-meteo.com')) return original(input, options);
    window.__weatherRequests.push(url);
    if (window.__weatherFail) return new Response('{}', { status: 503 });
    if (url.includes('geocoding-api')) return Response.json({results:[{name:'Local de teste', admin1:'RS', country:'Brasil', latitude:-30.03, longitude:-51.23}]});
    if (window.__weatherMalformed) return Response.json({daily:{time:[]}});
    const hoje = new Date();
    const time = Array.from({length:7}, (_, i) => {
      const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i, 12);
      return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}-${String(data.getDate()).padStart(2,'0')}`;
    });
    return Response.json({timezone:Intl.DateTimeFormat().resolvedOptions().timeZone, daily:{
      time, temperature_2m_max:[30,31,32,33,34,35,36], temperature_2m_min:[15,16,17,18,19,20,21],
      precipitation_probability_max:[70,10,80,20,30,40,50], precipitation_sum:[100,100,100,100,100,100,100],
      weather_code:[61,0,61,0,0,0,0], wind_speed_10m_max:[20,21,22,23,24,25,26]
    }});
  };
}

export async function testarClimaEChuva({ command, evaluate, until, click, fill }) {
  const mock = `(${simularOpenMeteo.toString()})()`;
  await command('Page.addScriptToEvaluateOnNewDocument', { source: mock });
  await evaluate(mock);
  await evaluate('window.__envioLiberado = false');
  await click('Registrar chuva');
  await fill('chuva-mm', '-1');
  await click('Salvar leitura');
  await until(`document.querySelector('.erro')?.textContent.includes('zero ou mais')`);
  await fill('chuva-mm', '18,5');
  await fill('chuva-obs', 'Madrugada');
  await click('Salvar leitura');
  await until(`document.querySelector('[data-total-chuva="hoje"]')?.textContent === '18,5 mm'`);
  assert.match(await evaluate(`document.querySelector('.toast').textContent`), /Leitura de chuva salva/);
  const validacoes = await evaluate(`(async () => {
    const {validarLeitura, totaisDeChuva} = await import('/src/lib/chuva.js');
    const invalidos = ['', ' ', '-1', 'abc', '1,2.3', 'Infinity', '0x10', '1e3'];
    const rejeitados = invalidos.every(v => { try { validarLeitura('2026-09-26',v); return false; } catch { return true; } });
    const datas = ['', '2026-02-30', '2026-13-01'];
    return {rejeitados, datas:datas.every(d => { try { validarLeitura(d,'1'); return false; } catch { return true; } }), zero:validarLeitura('2026-09-26','0'), ponto:validarLeitura('2026-09-26','1.5'), bissexto:validarLeitura('2024-02-29','2')};
  })()`);
  assert.deepEqual(validacoes, {rejeitados:true, datas:true, zero:0, ponto:1.5, bissexto:2});
  await evaluate(`(async () => {
    const {salvarRegistro} = await import('/src/lib/sync.js');
    const {hojeISO} = await import('/src/lib/apresentacao.js');
    for (const [dias, mm] of [[0,0],[-6,23.5],[-7,2],[-29,84.5],[-30,1000],[1,1000]]) {
      const data = new Date(hojeISO()+'T12:00:00Z'); data.setUTCDate(data.getUTCDate()+dias);
      await salvarRegistro('chuvas', {id:crypto.randomUUID(), data:data.toISOString().slice(0,10), mm, criadoEm:new Date().toISOString()});
    }
  })()`);
  await until(`document.querySelector('[data-total-chuva="mes"]')?.textContent === '128,5 mm'`);
  assert.equal(await evaluate(`document.querySelector('[data-total-chuva="semana"]').textContent`), '42,0 mm');
  await command('Page.reload');
  await until(`document.querySelector('[data-total-chuva="hoje"]')?.textContent === '18,5 mm'`);
  await click('Configurar localização');
  await fill('local-busca', 'Local de teste');
  await click('Buscar localidade');
  await until(`document.querySelector('main .row')?.textContent.includes('Local de teste')`);
  await evaluate(`document.querySelector('main .row').click()`);
  await click('Salvar localização');
  await until(`document.querySelectorAll('.clima-d').length === 6`);
  assert.match(await evaluate(`document.querySelector('.weather-section').textContent`), /Alta chance de chuva em 2 dias/);
  assert.equal(await evaluate(`document.querySelector('[data-total-chuva="mes"]').textContent`), '128,5 mm', 'Chuva prevista não entra nos totais');
  const req = new URL((await evaluate('window.__weatherRequests')).find(u => u.includes('/v1/forecast')));
  assert.equal(req.searchParams.get('timezone'), 'auto');
  assert.equal(req.searchParams.get('forecast_days'), '7');
  assert.equal(req.searchParams.get('latitude'), '-30.03');
  assert.equal(req.searchParams.get('longitude'), '-51.23');
  assert.deepEqual(req.searchParams.get('daily').split(','), ['temperature_2m_max','temperature_2m_min','precipitation_probability_max','precipitation_sum','weather_code','wind_speed_10m_max']);
  const cache = await evaluate(`(async () => (await import('/src/lib/db.js')).db.clima_cache.toArray())()`);
  assert.equal(cache.length, 1);
  assert.equal(cache[0].dias[0].chuvaPrevista, 100);
  assert.equal(cache[0].dias[0].codigoTempo, 61);
  assert.equal(cache[0].dias[0].ventoMaximo, 20);
  await command('Page.reload');
  await until(`document.querySelectorAll('.clima-d').length === 6`);
  assert.match(await evaluate(`document.querySelector('.weather-section').textContent`), /Local de teste/);
  assert.equal(await evaluate('window.__weatherRequests.length'), 0, 'Cache recente evita nova requisição');
  await evaluate('window.__weatherFail = true');
  await click('Atualizar previsão');
  await until(`document.querySelector('.weather-section .alert')?.textContent.includes('última previsão salva')`);
  assert.equal(await evaluate(`document.querySelectorAll('.clima-d').length`), 6);
  await evaluate(`Object.defineProperty(navigator, 'onLine', {configurable:true, get:()=>false})`);
  await click('Atualizar previsão');
  await until(`document.querySelector('.weather-section .alert')?.textContent.includes('última previsão salva')`);
  await click('Alterar localização');
  await fill('local-nome', 'Outra fazenda');
  await fill('local-latitude', '-31');
  await click('Salvar localização');
  await until(`document.querySelector('.weather-section')?.textContent.includes('Clima indisponível')`);
  assert.equal(await evaluate(`document.querySelectorAll('.clima-d').length`), 0, 'Não reutiliza cache de outra localização');
  await evaluate(`delete navigator.onLine; window.__weatherFail = false; window.dispatchEvent(new Event('online'))`);
  await until(`document.querySelectorAll('.clima-d').length === 6`);
  await evaluate('window.__weatherMalformed = true');
  await click('Atualizar previsão');
  await until(`document.querySelector('.weather-section .alert')?.textContent.includes('última previsão salva')`);
  await evaluate(`(async () => {
    const {db} = await import('/src/lib/db.js');
    const cache = await db.clima_cache.get('-31,-51.23');
    cache.atualizadoEm = '2020-01-01T12:00:00Z';
    cache.dias = cache.dias.map((d,i) => ({...d, data:'2020-01-0'+(i+1)}));
    await db.clima_cache.put(cache);
    window.__weatherFail = true;
  })()`);
  await click('Atualizar previsão');
  await until(`document.querySelector('.weather-section .alert')?.textContent.includes('dias anteriores')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('.cd-dia')].some(d => d.textContent === 'Hoje')`), false);
  await evaluate('window.__weatherFail = false; window.__weatherMalformed = false');
  await click('Atualizar previsão');
  await until(`document.querySelectorAll('.clima-d').length === 6 && !document.querySelector('.weather-section .alert')`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  await command('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'light'}] });
  await until(`getComputedStyle(document.body).backgroundColor === 'rgb(243, 244, 238)'`);
  assert.equal(await evaluate(`getComputedStyle(document.body).backgroundColor`), 'rgb(243, 244, 238)');
  await command('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'dark'}] });
  await until(`getComputedStyle(document.body).backgroundColor === 'rgb(16, 24, 18)'`);
  const fila = await evaluate(`(async () => { const {db} = await import('/src/lib/db.js'); return db.fila_sync.toArray(); })()`);
  assert.equal(fila.length, 7);
  assert.ok(fila.every(item => item.tabela === 'chuvas'), 'Cache e configuração não são sincronizados');
  await evaluate(`(async () => { window.__envioLiberado = true; await (await import('/src/lib/sync.js')).sincronizar(); })()`);
  const enviados = await evaluate('window.__enviados');
  assert.equal(enviados.length, 7);
  assert.ok(enviados.every(e => e.tabela === 'chuvas' && e.registro.criado_em && !('criadoEm' in e.registro)));
  assert.equal(enviados[0].registro.mm, 18.5);
  assert.equal(enviados[0].registro.obs, 'Madrugada');
  assert.equal(await evaluate(`(async () => (await import('/src/lib/db.js')).db.fila_sync.count())()`), 0);
  console.log('PASS: migração v1→v2, pluviômetro, limites de 7/30 dias, configuração, geocoding, 6 dias, cache/offline, recuperação, localização isolada, cache vencido e envio de chuvas.');
}
