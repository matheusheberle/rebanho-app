import assert from 'node:assert/strict';

export async function testarAgrupamentoLotes({ evaluate, until, click, command }) {
  await click('Início');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Por potreiro')`), false);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Pastos e potreiros')`), false);
  const antes = await evaluate(`(async () => { const {db}=await import('/src/lib/db.js'); return {fila:await db.fila_sync.toArray(),total:document.querySelector('.tag-num').textContent}; })()`);
  await evaluate(`(async () => {
    const {db}=await import('/src/lib/db.js');
    const p=Array.from({length:4},()=>crypto.randomUUID()), l=Array.from({length:5},()=>crypto.randomUUID());
    const eventos=l.map((loteId,i)=>({id:crypto.randomUUID(),loteId,tipo:'inicial',data:'2026-01-01',qtd:[10,20,5,0,50][i],pastoId:[p[1],p[0],p[1],p[1],p[0]][i]}));
    eventos.push({id:crypto.randomUUID(),loteId:l[0],tipo:'troca',data:'2026-01-02',pastoId:p[0]});
    eventos.push({id:crypto.randomUUID(),loteId:l[2],tipo:'compra',data:'2026-01-02',qtd:99,excluidoEm:'2026-01-03T00:00:00Z'});
    window.__agrupamento={p,l,eventos:eventos.map(e=>e.id)};
    await db.transaction('rw',db.pastos,db.lotes,db.eventos,async()=>{
      await db.pastos.bulkPut(p.map((id,i)=>({id,nome:['Curral do agrupamento','Baixada do agrupamento','Reserva vazia','Pasto oculto'][i],excluidoEm:i===3?'2026-01-01T00:00:00Z':null})));
      await db.lotes.bulkPut(l.map((id,i)=>({id,nome:['Grupo A','Grupo B','Grupo C','Grupo zerado','Grupo excluído'][i],categorias:['Bois'],excluidoEm:i===4?'2026-01-01T00:00:00Z':null})));
      await db.eventos.bulkPut(eventos);
    });
  })()`);
  try {
    await click('Lotes');
    await until(`document.querySelector('.pasture-groups')?.textContent.includes('Curral do agrupamento')`);
    const grupos = await evaluate(`window.__agrupamento.p.map(id=>document.querySelector('[data-pasto-id="'+id+'"]')?.textContent || null)`);
    assert.match(grupos[0], /Grupo A · Grupo B/);
    assert.match(grupos[0], /2 lotes · 30 cabeças/);
    assert.ok(!grupos[0].includes('Grupo excluído'));
    assert.match(grupos[1], /Grupo C · Grupo zerado/);
    assert.match(grupos[1], /2 lotes · 5 cabeças/);
    assert.ok(!grupos[1].includes('Grupo A'), 'Mudança de potreiro não duplica o lote no local anterior');
    assert.match(grupos[2], /Nenhum lote neste potreiro/);
    assert.match(grupos[2], /0 lotes · 0 cabeças/);
    assert.equal(grupos[3], null, 'Pasto excluído não aparece');
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('main h2')).map(h=>h.textContent)`), ['Todos os lotes','Por potreiro']);
    for (const tema of ['light','dark']) {
      await evaluate(`document.documentElement.dataset.theme='${tema}'`);
      await command('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
      assert.ok(await evaluate(`document.querySelector('.pasture-groups button').getBoundingClientRect().height>=44`));
    }
    await click('Pastos e potreiros');
    await until(`Boolean(document.querySelector('.pasture-list'))`);
    assert.equal(await evaluate(`document.querySelector('nav [aria-current="page"]').textContent`),'Lotes');
    await click('Lotes');
    await until(`Boolean(document.querySelector('.pasture-groups'))`);
  } finally {
    await evaluate(`(async()=>{const {db}=await import('/src/lib/db.js');const f=window.__agrupamento;await db.transaction('rw',db.pastos,db.lotes,db.eventos,async()=>{await db.eventos.bulkDelete(f.eventos);await db.lotes.bulkDelete(f.l);await db.pastos.bulkDelete(f.p);});})()`);
  }
  await click('Início');
  await until(`Boolean(document.querySelector('.tag-num'))`);
  const depois = await evaluate(`(async () => { const {db}=await import('/src/lib/db.js'); return {fila:await db.fila_sync.toArray(),total:document.querySelector('.tag-num').textContent}; })()`);
  assert.deepEqual(depois, antes, 'Agrupamento não altera saldo nem fila');
  console.log('PASS organização de Lotes: Home limpa, grupos por local atual, contagens, lote zerado, exclusões, local vazio, navegação, temas e 320 px.');
}
