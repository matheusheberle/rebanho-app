import { abrirConfiguracoes } from './settings-navigation.mjs';
import assert from 'node:assert/strict';

function instalarLocalizacaoMock() {
  window.__gpsCalls = 0; window.__reverseCalls = 0; window.__gpsMode = 'ok'; window.__reverseMode = 'ok';
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition(ok, erro, options) {
      window.__gpsCalls++; window.__gpsOptions = options;
      if (window.__gpsMode === 'pendente') { window.__gpsResolve = ok; return; }
      if (window.__gpsMode !== 'ok') { erro({ code: Number(window.__gpsMode), message: 'Mensagem técnica que não deve aparecer' }); return; }
      ok({ coords: { latitude: -24.95, longitude: -53.45, accuracy: 25 } });
    },
    watchPosition() { throw new Error('Rastreamento proibido'); }
  } });
  const original = window.fetch.bind(window);
  window.fetch = async (input, options) => {
    const url = String(input);
    if (url.startsWith('https://api.bigdatacloud.net/data/reverse-geocode-client')) {
      window.__reverseCalls++;
      if (window.__reverseMode === 'falha') return new Response('{}', { status: 503 });
      if (window.__reverseMode === 'json') return new Response('inválido');
      const params = new URL(url).searchParams;
      return Response.json({ latitude: Number(params.get('latitude')), longitude: Number(params.get('longitude')),
        lookupSource: window.__reverseMode === 'ip' ? 'ipGeolocation' : 'coordinates',
        countryCode: window.__reverseMode === 'exterior' ? 'US' : 'BR', principalSubdivisionCode: 'BR-PR',
        city: 'Cascavel', locality: 'Cascavel' });
    }
    if (url.includes('geocoding-api.open-meteo.com') && new URL(url).searchParams.get('name') === 'Dourados')
      return Response.json({ results: [{ name: 'Dourados', admin1: 'Mato Grosso do Sul', admin2: 'Dourados', country: 'Brasil', country_code: 'BR', latitude: -22.22, longitude: -54.8 }] });
    return original(input, options);
  };
}

export async function testarPropriedade({ command, evaluate, until, click, fill }) {
  const mock = `(${instalarLocalizacaoMock.toString()})()`;
  await command('Page.addScriptToEvaluateOnNewDocument', { source: mock }); await evaluate(mock);
  const escolherUF = (id, uf) => evaluate(`(() => { const s=document.getElementById('${id}'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${uf}'); s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  const fila = await evaluate(`(async () => { const {db}=await import('/src/lib/db.js'); window.__envioLiberado=false;
    await db.configuracoes.delete('localizacao'); await db.configuracoes.put({chave:'cotacao:preferencia',origem:'propriedade'});
    return await db.fila_sync.toArray(); })()`);
  await abrirConfiguracoes({ evaluate, until, click });
  await until(`document.querySelector('.property-section')?.textContent.includes('Configure a localização da propriedade')`);
  assert.equal(await evaluate('window.__gpsCalls'), 0, 'Não pede GPS ao abrir');
  await click('Usar minha localização');
  await until(`document.querySelector('#local-municipio')?.value === 'Cascavel'`);
  assert.equal(await evaluate('window.__gpsCalls'), 1);
  assert.equal(await evaluate('window.__reverseCalls'), 1);
  assert.equal(await evaluate('window.__gpsOptions.maximumAge'), 0);
  assert.equal(await evaluate(`(async () => Boolean(await (await import('/src/lib/db.js')).db.configuracoes.get('localizacao')))()`), false, 'Exige confirmar antes de trocar a propriedade');
  await click('Salvar localização');
  await until(`document.querySelector('.quote-region')?.textContent.includes('Paraná')`);
  await until(`document.querySelectorAll('.clima-d').length === 6`);
  assert.equal(await evaluate(`(async () => (await (await import('/src/lib/cotacao.js')).lerCotacaoSelecionada()).preferencia.origem)()`), 'propriedade');
  assert.ok((await evaluate('window.__weatherRequests')).some(u => u.includes('latitude=-24.95') && u.includes('longitude=-53.45')));
  await command('Page.reload');
  await until(`document.querySelector('.location-caption')?.textContent.includes('Cascavel')`);
  assert.equal(await evaluate('window.__gpsCalls'), 0, 'Reabrir mantém a propriedade sem consultar GPS');
  assert.equal(await evaluate('window.__reverseCalls'), 0);

  await abrirConfiguracoes({ evaluate, until, click }); await click('Atualizar localização'); await click('Escolher manualmente');
  await fill('local-busca', 'Dourados'); await click('Buscar localidade');
  await until(`document.querySelector('main .row')?.textContent.includes('Dourados')`);
  await evaluate(`document.querySelector('main .row').click()`);
  assert.equal(await evaluate(`document.querySelector('#local-uf').value`), 'MS');
  await click('Salvar localização');
  await until(`document.querySelector('.quote-region')?.textContent.includes('Mato Grosso do Sul') && document.querySelector('.quote-price')?.textContent.includes('350,00')`);
  await until(`document.querySelectorAll('.clima-d').length === 6`);
  assert.ok((await evaluate('window.__weatherRequests')).some(u => u.includes('latitude=-22.22') && u.includes('longitude=-54.8')));
  assert.equal(await evaluate('window.__gpsCalls'), 0, 'Busca manual não pede GPS');
  assert.ok((await evaluate('window.__cotacaoChamadas')).includes('MS'));

  // Exceção comercial é secundária; retornar à UF da propriedade não copia dados.
  await abrirConfiguracoes({ evaluate, until, click }); await click('Alterar UF comercial');
  await until(`Boolean(document.querySelector('#cotacao-uf'))`);
  await escolherUF('cotacao-uf', 'PR'); await click('Salvar região');
  await until(`document.querySelector('.quote-region')?.textContent.includes('Paraná')`);
  assert.match(await evaluate(`document.querySelector('.location-caption').textContent`), /Dourados/);
  await abrirConfiguracoes({ evaluate, until, click }); await click('Alterar UF comercial');
  await until(`Boolean(document.querySelector('#cotacao-uf'))`); await click('Usar UF da propriedade (MS)');
  await until(`document.querySelector('.quote-region')?.textContent.includes('Mato Grosso do Sul')`);
  await evaluate(`Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));`);
  await until(`document.querySelector('.quote-section')?.textContent.includes('Última cotação disponível')`);
  assert.match(await evaluate(`document.querySelector('.quote-price').textContent`), /350,00/);
  assert.match(await evaluate(`document.querySelector('.location-caption').textContent`), /Dourados/);
  await evaluate(`delete navigator.onLine; window.dispatchEvent(new Event('online'));`);

  await abrirConfiguracoes({ evaluate, until, click }); await click('Atualizar localização');
  for (const [code, palavra] of [['1','acessar'],['3','demorou'],['2','indisponível']]) {
    await evaluate(`window.__gpsMode='${code}'`);
    await click(code === '1' ? 'Usar minha localização' : 'Tentar novamente');
    await until(`document.querySelector('.erro')?.textContent.includes('${palavra}')`);
    assert.ok(!(await evaluate(`document.querySelector('main').textContent`)).includes('Mensagem técnica'));
    assert.equal(await evaluate('window.__reverseCalls'), 0, 'Sem geocoding quando GPS falha');
  }
  await evaluate(`window.__gpsMode='ok';window.__reverseMode='falha'`); await click('Tentar novamente');
  await until(`document.querySelector('#local-uf')?.value === '' && document.querySelector('#local-latitude')?.value === '-24.95'`);
  assert.equal(await evaluate(`(async () => (await (await import('/src/lib/propriedade.js')).lerPropriedade()).uf)()`), 'MS', 'Falha não substitui configuração salva');
  await escolherUF('local-uf', 'PR'); await fill('local-municipio', 'Cascavel');
  await evaluate(`Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));`);
  await click('Salvar localização');
  await until(`document.querySelector('.quote-region')?.textContent.includes('Paraná')`);
  assert.equal(await evaluate(`document.querySelectorAll('.clima-d').length`), 0, 'Alteração offline não reaproveita previsão da outra cidade ou cache anterior da posição');
  assert.match(await evaluate(`document.querySelector('.quote-price').textContent`), /367,00/, 'Cache separado por UF');
  await evaluate(`delete navigator.onLine; window.__reverseMode='ok'; window.dispatchEvent(new Event('online'));`);
  await until(`document.querySelectorAll('.clima-d').length === 6`);

  const protecoes = await evaluate(`(async () => {
    const {obterLocalizacaoAtual,normalizarPropriedade}=await import('/src/lib/propriedade.js');
    const invalidas=[];
    for(const modo of ['ip','json','exterior']) { window.__reverseMode=modo; const p=await obterLocalizacaoAtual(); invalidas.push(p.uf===null && p.latitude===-24.95); }
    window.__reverseMode='ok';
    const legado=normalizarPropriedade({nome:'Cascavel, Paraná, Brasil',latitude:-24.95,longitude:-53.45});
    const ambiguo=normalizarPropriedade({nome:'Minha fazenda',latitude:-24.95,longitude:-53.45});
    return {invalidas:invalidas.every(Boolean),legado:legado.uf==='PR'&&legado.municipio==='Cascavel',ambiguo:ambiguo.uf===null};
  })()`);
  assert.deepEqual(protecoes, { invalidas:true, legado:true, ambiguo:true });
  // Sair antes do retorno do GPS ignora a resposta e não consulta geocoding.
  await abrirConfiguracoes({ evaluate, until, click }); await click('Atualizar localização'); await evaluate(`window.__gpsMode='pendente'`);
  await click('Usar minha localização'); await click('Início');
  const antes = await evaluate('window.__reverseCalls');
  await evaluate(`window.__gpsResolve({coords:{latitude:0,longitude:0}})`);
  assert.equal(await evaluate('window.__reverseCalls'), antes);
  await until(`Boolean(document.querySelector('.location-caption'))`);
  for (const tema of ['light','dark']) {
    await evaluate(`document.documentElement.dataset.theme='${tema}'`);
    await command('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
  }
  assert.deepEqual(await evaluate(`(async () => (await import('/src/lib/db.js')).db.fila_sync.toArray())()`), fila, 'Propriedade não entra na sincronização');
  console.log('PASS propriedade A–O: GPS por ação, confirmação, permissão/timeout/indisponível, busca manual, UF compartilhada, exceção comercial, caches isolados, recarga sem GPS, offline, cancelamento, legado, temas e 320 px.');
}
