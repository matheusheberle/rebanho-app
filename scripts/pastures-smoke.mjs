import assert from 'node:assert/strict';

export async function testarPastos({ evaluate, until, click, fill, command }) {
  assert.ok(await evaluate(`document.querySelectorAll('.category-badges li.chip').length>0`));
  assert.equal(await evaluate(`document.querySelectorAll('.category-badges button').length`),0);
  for (const tema of ['light','dark']) {
    await evaluate(`document.documentElement.dataset.theme='${tema}'`);
    await command('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('.category-badges .chip')).color!==getComputedStyle(document.body).backgroundColor`));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('Lotes'); await click('Pastos e potreiros');
  assert.equal(await evaluate(`document.querySelectorAll('nav button').length`),4);
  await click('Novo pasto'); await fill('pasto-nome','   '); await click('Salvar pasto');
  await until(`document.querySelector('.erro')?.textContent.includes('Informe o nome')`);
  await fill('pasto-nome','  Fundo   da Fazenda  '); await click('Salvar pasto');
  await until(`document.querySelector('.pasture-list')?.textContent.includes('Fundo da Fazenda')`);
  await click('Novo pasto'); await fill('pasto-nome','fundo da fazenda'); await click('Salvar pasto');
  await until(`document.querySelector('.erro')?.textContent.includes('Já existe')`);
  await click('Cancelar');
  const acao = (nome,qual) => evaluate(`([...document.querySelectorAll('.pasture-list li')].find(l=>l.textContent.includes(${JSON.stringify(nome)}))).querySelector('[aria-label="${qual} registro"]').click()`);
  await acao('Fundo da Fazenda','Editar');
  await until(`document.querySelector('#pasto-nome')?.value==='Fundo da Fazenda'`);
  await fill('pasto-nome','Potreiro de teste'); await click('Salvar pasto');
  await until(`document.querySelector('.erro')?.textContent.includes('Já existe')`);
  await fill('pasto-nome','Fundo renomeado'); await click('Salvar pasto');
  await until(`document.querySelector('.pasture-list')?.textContent.includes('Fundo renomeado')`);
  await acao('Potreiro de teste','Excluir');
  await evaluate(`document.querySelector('dialog[open] .dialog-actions button:last-child').click()`);
  await until(`document.querySelector('dialog[open] .erro')?.textContent.includes('não pode ser excluído')`);
  await evaluate(`document.querySelector('dialog[open] .dialog-actions button:first-child').click()`);

  // Referência antiga, sem ocupação atual: nome deve sobreviver à exclusão.
  await evaluate(`(async()=>{
    const {db}=await import('/src/lib/db.js'); const {salvarRegistro}=await import('/src/lib/sync.js');
    const p=(await db.pastos.toArray()).find(p=>p.nome==='Fundo renomeado');
    const lote=(await db.lotes.toArray()).find(l=>l.nome==='Categoria única');
    window.__pastoHistorico=p.id;
    await salvarRegistro('eventos',{id:crypto.randomUUID(),loteId:lote.id,tipo:'troca',pastoId:p.id,data:'2000-01-01'});
  })()`);
  await acao('Fundo renomeado','Excluir');
  await evaluate(`document.querySelector('dialog[open] .dialog-actions button:last-child').click()`);
  await until(`document.querySelector('.toast')?.textContent.includes('Registro excluído')`);
  await click('Desfazer'); await until(`document.querySelector('.pasture-list')?.textContent.includes('Fundo renomeado')`);
  await acao('Fundo renomeado','Excluir');
  await evaluate(`document.querySelector('dialog[open] .dialog-actions button:last-child').click()`);
  await until(`!document.querySelector('.pasture-list')?.textContent.includes('Fundo renomeado')`);
  await click('Histórico');
  await until(`document.querySelector('.event-list')?.textContent.includes('Mudança para Fundo renomeado')`);
  await click('Lotes'); await click('Novo lote');
  assert.ok(!(await evaluate(`document.querySelector('form').textContent`)).includes('Fundo renomeado'));
  await click('Outro potreiro'); await fill('pasto-nome','POTREIRO DE TESTE'); await fill('quantidade','2'); await click('Criar lote');
  await until(`document.querySelector('.erro')?.textContent.includes('Já existe')`);
  await click('Lotes');
  await evaluate(`([...document.querySelectorAll('main .row')].find(e=>e.textContent.includes('Categoria única'))).click()`);
  await click('Mudar de potreiro');
  await until(`document.querySelector('h1')?.textContent.includes('potreiro')`);
  assert.ok(!(await evaluate(`document.querySelector('form').textContent`)).includes('Fundo renomeado'));
  await click('Outro potreiro'); await fill('pasto-nome','POTREIRO DE TESTE'); await click('Salvar registro');
  await until(`document.querySelector('.erro')?.textContent.includes('Já existe')`);
  const resultado=await evaluate(`(async()=>{
    const {db}=await import('/src/lib/db.js');
    const {conferirDestinoAtual,usoDoPasto}=await import('/src/lib/pastos.js');
    const pastos=[{id:'antigo',excluidoEm:'2026-01-01'},{id:'novo'}];
    const antes=[{id:'i',loteId:'l',tipo:'inicial',qtd:2,data:'2026-01-01',pastoId:'antigo'},{id:'t',loteId:'l',tipo:'troca',data:'2026-01-02',pastoId:'novo'}];
    let bloqueou=false;
    try { conferirDestinoAtual('l',antes,antes.slice(0,1),pastos); } catch(e) { bloqueou=e.message.includes('pasto excluído'); }
    if(!bloqueou) throw new Error('Excluir mudança recolocaria lote em pasto excluído');
    const uso=usoDoPasto('novo',[{id:'l'},{id:'excluido',excluidoEm:'2026-01-01'}],antes);
    if(uso.lotes!==1 || uso.cabecas!==2) throw new Error('Ocupação duplicada');
    const {salvarPasto,desfazerExclusao}=await import('/src/lib/manutencao.js');
    const antigo=await db.pastos.get(window.__pastoHistorico);
    await salvarPasto('Fundo renomeado');
    try { await desfazerExclusao('pastos',antigo); return false; } catch(e) { return e.message.includes('Já existe'); }
  })()`);
  assert.equal(resultado,true,'Desfazer não cria duplicidade');
  await click('Início');
  console.log('PASS pastos A–N: criar/editar, nomes vazios/duplicados, uso atual, excluir/desfazer, opções ativas, nome histórico, badges, 320px e temas.');
}
