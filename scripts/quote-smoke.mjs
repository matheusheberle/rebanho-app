import assert from 'node:assert/strict';

function instalarMock() {
  const original=window.fetch.bind(window);
  window.__cotacaoModo='ok'; window.__cotacaoChamadas=[];
  window.fetch=async (url,options)=>{
    if(!String(url).startsWith('https://agrodocai.com.br/api/v1/cotacao'))return original(url,options);
    const uf=new URL(String(url)).searchParams.get('uf');
    window.__cotacaoChamadas.push(uf);
    if(window.__cotacaoModo==='500')return new Response('{}',{status:500});
    if(window.__cotacaoModo==='429')return new Response('{}',{status:429,headers:{'Retry-After':'3600'}});
    if(window.__cotacaoModo==='json')return new Response('não é json');
    if(window.__cotacaoModo==='estranho')return Response.json({valor:0});
    if(window.__cotacaoModo==='sem')return Response.json({boi_gordo_cepea_sp:358.8,boi_gordo_uf:null});
    return Response.json({boi_gordo_cepea_sp:358.8,boi_gordo_uf:{uf,preco:uf==='PR'?367:350,praca:uf},atualizado:'2026-09-26T18:06:12-04:00',fonte:'CEPEA/ESALQ · NoticiasAgricolas · Scot Consultoria',license:'CC-BY-4.0 · atribuição AgroDoc AI'});
  };
}

export async function testarCotacao({evaluate,until,click,fill,command}) {
  const mock=`(${instalarMock.toString()})()`;
  await command('Page.addScriptToEvaluateOnNewDocument',{source:mock}); await evaluate(mock);
  const estado=await evaluate(`(async()=>{const {db}=await import('/src/lib/db.js');return {fila:await db.fila_sync.toArray(),clima:await db.configuracoes.get('localizacao'),total:document.querySelector('.tag-num').textContent};})()`);
  await click('Escolher região'); await until(`!!document.querySelector('#cotacao-uf')`);
  assert.equal(await evaluate(`document.querySelectorAll('.cotacao-form input').length`),0,'Só pede UF');
  await evaluate(`(()=>{const s=document.querySelector('#cotacao-uf');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'PR');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('Salvar região'); await until(`document.querySelector('.quote-price')?.textContent.includes('367,00')`);
  assert.equal(await evaluate(`window.__cotacaoChamadas.length`),1,'Deduplica StrictMode e renders');
  assert.match(await evaluate(`document.querySelector('.quote-region').textContent`),/Paraná \(PR\)/);
  assert.ok(!(await evaluate(`document.querySelector('.quote-section').textContent`)).includes('Valor informado manualmente'));
  assert.equal(await evaluate(`!!document.querySelector('.quote-options')`),false);
  await click('Atualizar'); await until(`!document.querySelector('.quote-actions button').disabled`);
  assert.equal(await evaluate(`window.__cotacaoChamadas.length`),1,'Limite mínimo entre cliques');
  await command('Page.reload'); await until(`document.querySelector('.quote-price')?.textContent.includes('367,00')`);
  assert.equal(await evaluate(`window.__cotacaoChamadas.length`),0,'Recarga usa cache persistente');
  const liberar=()=>evaluate(`(async()=>{const {db}=await import('/src/lib/db.js');const p=await db.configuracoes.get('cotacao:preferencia');await db.configuracoes.update('cotacao:estado:'+p.uf,{ultimaTentativa:0,tentarApos:0});await db.configuracoes.update('cotacao:agrodoc:limites',{tentarApos:0});})()`);
  await evaluate(`(async()=>{const {db}=await import('/src/lib/db.js');await db.configuracoes.update('cotacao:automatico:PR',{atualizadoLocalmenteEm:'2020-01-01T00:00:00Z'});await db.configuracoes.update('cotacao:estado:PR',{ultimaTentativa:0});document.dispatchEvent(new Event('visibilitychange'));})()`);
  await until(`window.__cotacaoChamadas.length===1 && !document.querySelector('.quote-actions button').disabled`);
  await evaluate(`Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));`);
  await until(`document.querySelector('.quote-section')?.textContent.includes('Última cotação disponível')`);
  assert.ok((await evaluate(`document.querySelector('.quote-price').textContent`)).includes('367,00'));
  await evaluate(`document.querySelector('.quote-options').open=true`); await click('Informar valor manualmente');
  await until(`!!document.querySelector('#cotacao-valor')`); await fill('cotacao-valor','-1'); await click('Salvar valor manual');
  await until(`document.querySelector('.erro')?.textContent.includes('positivo')`);
  await fill('cotacao-valor','360,50'); await click('Salvar valor manual');
  await until(`document.querySelector('.quote-section')?.textContent.includes('Valor informado manualmente')`);
  assert.ok((await evaluate(`document.querySelector('.quote-price').textContent`)).includes('360,50'));
  await liberar(); await evaluate(`delete navigator.onLine;window.dispatchEvent(new Event('online'));`);
  await until(`document.querySelector('.quote-price')?.textContent.includes('367,00') && !document.querySelector('.quote-section').textContent.includes('Valor informado manualmente')`);

  for(const modo of ['500','429','json','estranho','sem']) {
    await liberar(); await evaluate(`window.__cotacaoModo='${modo}'`); await click('Atualizar');
    await until(`!document.querySelector('.quote-actions button').disabled && !!document.querySelector('.quote-options')`);
    assert.ok((await evaluate(`document.querySelector('.quote-price').textContent`)).includes('367,00'),modo+' preserva cache');
    if(modo==='429') {
      const antes=await evaluate(`window.__cotacaoChamadas.length`);
      await click('Atualizar'); await until(`!document.querySelector('.quote-actions button').disabled`);
      assert.equal(await evaluate(`window.__cotacaoChamadas.length`),antes,'429 bloqueia novas consultas');
    }
  }
  // UF sem cache não recebe indicador nacional como substituto.
  await evaluate(`(async()=>{const {salvarPreferenciaCotacao}=await import('/src/lib/cotacao.js');await salvarPreferenciaCotacao('AC');})()`);
  await until(`document.querySelector('.quote-section')?.textContent.includes('Cotação indisponível no momento.')`);
  assert.equal(await evaluate(`!!document.querySelector('.quote-price')`),false);
  await evaluate(`(async()=>{window.__cotacaoModo='ok';const {salvarPreferenciaCotacao}=await import('/src/lib/cotacao.js');await salvarPreferenciaCotacao('PR');})()`);
  await until(`document.querySelector('.quote-region')?.textContent.includes('Paraná') && !document.querySelector('.quote-actions button').disabled`);
  await liberar(); await click('Atualizar'); await until(`document.querySelector('.quote-price')?.textContent.includes('367,00') && !document.querySelector('.quote-options')`);

  const validacoes=await evaluate(`(async()=>{
    const {interpretarCotacao,buscarCotacaoArroba,carregarCotacaoArroba,salvarCotacaoManual}=await import('/src/lib/cotacao.js');
    const simples={produto:'boi_gordo',uf:'PR',valor:358.8,moeda:'BRL',unidade:'@',fonte:'scot_consultoria',data_cotacao:'2026-09-26'};
    const plano=interpretarCotacao(simples,'PR');
    const invalidos=[{...simples,uf:'SP'},{...simples,valor:0},{...simples,valor:null},{...simples,unidade:'kg'},{...simples,produto:'soja'},{...simples,data_cotacao:'2026-02-30'},{boi_gordo_cepea_sp:360},null,[]];
    const rejeitados=invalidos.every(r=>{try{interpretarCotacao(r,'PR');return false;}catch{return true;}});
    let timeout=false,manualBloqueado=false;
    try{await buscarCotacaoArroba('PR',{fetchImpl:()=>new Promise(()=>{}),timeoutMs:20});}catch(e){timeout=e.codigo==='timeout';}
    try{await salvarCotacaoManual('PR',{valor:'12',data:'2026-01-01'});}catch(e){manualBloqueado=e.codigo==='manual';}
    const {db}=await import('/src/lib/db.js');
    await db.configuracoes.update('cotacao:estado:PR',{ultimaTentativa:0});
    const antes=window.__cotacaoChamadas.length;
    await Promise.all(Array.from({length:12},()=>carregarCotacaoArroba({forcar:true})));
    const dedup=window.__cotacaoChamadas.length===antes+1;
    return {plano:plano.valor===358.8&&!plano.dataEhAtualizacao,rejeitados,timeout,manualBloqueado,dedup};
  })()`);
  assert.ok(Object.values(validacoes).every(Boolean),JSON.stringify(validacoes));
  const legado=await evaluate(`(async()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));
    const {db}=await import('/src/lib/db.js');const {carregarCotacaoArroba,lerCotacaoSelecionada}=await import('/src/lib/cotacao.js');
    await db.transaction('rw',db.configuracoes,async()=>{
      await db.configuracoes.delete('cotacao:preferencia');
      await db.configuracoes.put({chave:'cotacao:praca',uf:'PR',regiao:'Noroeste',id:'pr-noroeste',fonte:'manual'});
      await db.configuracoes.put({chave:'cotacao:cache:manual:pr-noroeste',valor:355,data:'2026-01-01',fonteInformada:'Legado',atualizadoEm:'2026-01-01T00:00:00Z'});
    });
    await carregarCotacaoArroba();const d=await lerCotacaoSelecionada();
    return d.preferencia.uf==='PR' && d.cotacao.modo==='manual' && d.cotacao.valor===355 && d.cotacao.referenciaLegada==='Noroeste' && Boolean(await db.configuracoes.get('cotacao:cache:manual:pr-noroeste'));
  })()`);
  assert.equal(legado,true,'Migra UF e preserva manual legado explicitamente identificado');
  await liberar(); await evaluate(`delete navigator.onLine;window.dispatchEvent(new Event('online'));`);
  await until(`document.querySelector('.quote-price')?.textContent.includes('367,00') && !document.querySelector('.quote-section').textContent.includes('Valor informado manualmente')`);
  for(const tema of ['light','dark']) {
    await evaluate(`document.documentElement.dataset.theme='${tema}'`);
    await command('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('.quote-price')).color!==getComputedStyle(document.body).backgroundColor`));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const depois=await evaluate(`(async()=>{const {db}=await import('/src/lib/db.js');return {fila:await db.fila_sync.toArray(),clima:await db.configuracoes.get('localizacao'),total:document.querySelector('.tag-num').textContent};})()`);
  assert.deepEqual(depois,estado,'Cotação não muda dados do rebanho ou clima');
  console.log('PASS AgroDoc A–O: UF, automático, persistência, TTL, offline, HTTP/429/JSON/formato/UF ausente, timeout, manual e recuperação, concorrência, temas e 320px.');
}
