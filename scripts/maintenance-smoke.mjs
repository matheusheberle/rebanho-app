import { abrirConfiguracoes } from './settings-navigation.mjs';
import assert from 'node:assert/strict';

export async function testarManutencao({ evaluate, until, click, fill, command }) {
  const eventoAcao = async (texto, acao) => evaluate(`(() => {
    const linha = [...document.querySelectorAll('.ev')].find(e => e.textContent.includes(${JSON.stringify(texto)}));
    if (!linha) throw new Error('Evento não encontrado');
    linha.querySelector('[aria-label="${acao} registro"]').click();
  })()`);
  await click('Histórico');
  await eventoAcao('Peso médio', 'Editar');
  await until(`!!document.querySelector('#peso')`);
  await fill('peso', '360,5'); await click('Salvar alterações');
  await until(`document.querySelector('.stats')?.textContent.includes('360,5')`);
  await eventoAcao('Venda', 'Editar');
  await until(`!!document.querySelector('#quantidade')`);
  await fill('quantidade', '30'); await click('Salvar alterações');
  await until(`document.querySelector('.erro')?.textContent.includes('histórico')`);
  await fill('quantidade', '3'); await click('Salvar alterações');
  await until(`document.querySelector('.saldo')?.textContent === '9cabeças'`);
  await eventoAcao('Peso médio', 'Excluir');
  await until(`!!document.querySelector('dialog[open]')`);
  await evaluate(`document.querySelector('dialog[open] .dialog-actions button:last-child').click()`);
  await until(`document.querySelector('.toast')?.textContent.includes('Registro excluído')`);
  assert.ok(!(await evaluate(`document.querySelector('.event-list').textContent`)).includes('Peso médio'));
  await click('Desfazer');
  await until(`document.querySelector('.event-list')?.textContent.includes('360,5')`);

  // Validação de exclusão/edição histórica, proteção contra formulário antigo,
  // transação offline e tombstones persistidos, sem apagar dados de produção.
  const validacoes = await evaluate(`(async () => {
    const {db} = await import('/src/lib/db.js');
    const {validarHistorico,excluirRegistro,desfazerExclusao,editarLote,salvarLeitura} = await import('/src/lib/manutencao.js');
    const {salvarRegistro,sincronizarTudo} = await import('/src/lib/sync.js');
    const falha = async (fn, trecho) => { try { await fn(); return false; } catch(e) { return e.message.includes(trecho); } };
    const lote = (await db.lotes.toArray()).find(l=>l.nome==='Lote de teste');
    const inicial = (await db.eventos.where('loteId').equals(lote.id).toArray()).find(e=>e.tipo==='inicial');
    const inicialProtegido = await falha(()=>excluirRegistro('eventos',inicial),'criação');
    const historico = [
      {id:'i',loteId:'l',tipo:'inicial',qtd:2,data:'2026-01-01'},
      {id:'c',loteId:'l',tipo:'compra',qtd:5,data:'2026-01-02'},
      {id:'v',loteId:'l',tipo:'venda',qtd:6,data:'2026-01-03'},
      {id:'n',loteId:'l',tipo:'nascimento',qtd:10,data:'2026-01-04'}];
    const historicoProtegido = await falha(()=>validarHistorico('l',historico.filter(e=>e.id!=='c')),'histórico');
    const saldoFinalNaoBasta = await falha(()=>validarHistorico('l',historico.map(e=>e.id==='v'?{...e,qtd:8}:e)),'histórico');
    window.__envioLiberado=false;
    await salvarRegistro('lotes',{id:lote.id,nome:'Mudança concorrente'});
    const stale = await falha(()=>editarLote({...lote,nome:'Obsoleto'},lote),'mudou');
    const atual=await db.lotes.get(lote.id);
    await editarLote({...atual,nome:'Lote de teste'},atual);
    const chuva = (await db.chuvas.toArray())[0];
    const duplicada = await falha(()=>salvarLeitura({...chuva,id:crypto.randomUUID()}),'Já existe');
    const tombstone=await excluirRegistro('chuvas',chuva);
    const offline=Boolean((await db.chuvas.get(chuva.id)).excluidoEm) && await db.fila_sync.count()>0;
    await desfazerExclusao('chuvas',tombstone);
    window.__envioLiberado=true; await sincronizarTudo();
    return {inicialProtegido,historicoProtegido,saldoFinalNaoBasta,stale,duplicada,offline};
  })()`);
  assert.ok(Object.values(validacoes).every(Boolean), JSON.stringify(validacoes));

  await click('Início'); await click('Registrar chuva');
  await fill('chuva-mm','12,5'); await click('Salvar leitura');
  await until(`document.querySelector('.erro')?.textContent.includes('Já existe uma leitura')`);
  await click('Editar leitura');
  await until(`document.querySelector('#chuva-mm')?.value === '18.5'`);
  await fill('chuva-mm','20,5'); await fill('chuva-obs','Leitura corrigida'); await click('Salvar leitura');
  await until(`document.querySelector('[data-total-chuva="hoje"]')?.textContent === '20,5 mm'`);
  await evaluate(`document.querySelector('.rain-readings').open=true; [...document.querySelectorAll('.reading-row')].find(e=>e.textContent.includes('Leitura corrigida')).querySelector('[aria-label="Excluir registro"]').click()`);
  await evaluate(`document.querySelector('dialog[open] .dialog-actions button:last-child').click()`);
  await until(`document.querySelector('[data-total-chuva="hoje"]')?.textContent === '0,0 mm'`);
  await click('Desfazer');
  await until(`document.querySelector('[data-total-chuva="hoje"]')?.textContent === '20,5 mm'`);

  await click('Lotes');
  await evaluate(`([...document.querySelectorAll('main .row')].find(e=>e.textContent.includes('Lote de teste'))).click()`);
  await evaluate(`document.querySelector('.lote-summary [aria-label="Editar registro"]').click()`);
  await until(`!!document.querySelector('#lote-nome')`);
  await fill('lote-nome','Lote corrigido'); await click('Salvar lote');
  await until(`document.querySelector('h1')?.textContent==='Lote corrigido'`);
  await evaluate(`document.querySelector('.lote-summary [aria-label="Excluir registro"]').click()`);
  await until(`document.querySelector('dialog[open]')?.textContent.includes('seu histórico')`);
  await click('Excluir lote');
  await until(`document.querySelector('.toast')?.textContent.includes('Registro excluído')`);
  await click('Histórico');
  assert.ok(!(await evaluate(`document.querySelector('main').textContent`)).includes('Lote corrigido'));
  await click('Desfazer');
  await until(`document.querySelector('main')?.textContent.includes('Lote corrigido')`);

  await click('Início');
  await until(`document.querySelector('.sync-state')?.textContent==='Sincronizado'`);
  // Exercita cada gatilho sem polling, usando alterações que só existem na nuvem.
  for (const gatilho of ['manual','visibilitychange','focus','online']) {
    await until(`document.querySelector('.sync-state')?.textContent==='Sincronizado'`);
    await evaluate(`(() => {
      const lote=[...window.__supabaseMock.tabelas.lotes.values()].find(l=>l.nome.startsWith('Lote corrigido'));
      window.__gatilhoNome='Lote corrigido ${gatilho}';
      window.__supabaseMock.tabelas.lotes.set(lote.id,{...lote,nome:window.__gatilhoNome,atualizado_em:new Date(Date.parse(lote.atualizado_em)+1000).toISOString()});
    })()`);
    if (gatilho === 'manual') { await abrirConfiguracoes({ evaluate, until, click }); await click('Sincronizar agora'); }
    else await evaluate(`${gatilho==='visibilitychange'?'document':'window'}.dispatchEvent(new Event('${gatilho}'))`);
    await until(`(async()=>{const {db}=await import('/src/lib/db.js'); return (await db.lotes.toArray()).some(l=>l.nome===window.__gatilhoNome);})()`);
  }
  await command('Page.reload');
  await until(`document.querySelector('.tag-num')?.textContent==='13'`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  console.log('PASS manutenção A–Q: edição, saldo histórico, exclusão/undo, chuva duplicada, lotes, offline, retorno à aba, focus, online e sincronização manual (transporte simulado).');
}
