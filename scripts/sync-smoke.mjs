import assert from 'node:assert/strict';

export async function testarSincronizacao({ evaluate, until }) {
  const resultado = await evaluate(`(async () => {
    const {default: Dexie} = await import('/node_modules/dexie/dist/dexie.mjs');
    const {criarSincronizador} = await import('/src/lib/sync-engine.js');
    const {paraSupabase, doSupabase, compararVersoes} = await import('/src/lib/sync-records.js');
    const {criarSupabaseMock} = await import('/scripts/supabase-mock.js');
    const conferir = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };
    const igual = (a,b,msg) => conferir(JSON.stringify(a) === JSON.stringify(b), msg);
    conferir(compararVersoes({atualizadoEm:'2026-01-01T12:00:00.123999Z'}, {atualizadoEm:'2026-01-01T12:00:00.123001Z'}) === 1, 'Precisão de microssegundos');
    conferir(compararVersoes({atualizadoEm:'2026-01-01T12:00:00Z'}, {atualizadoEm:'2026-01-01T09:00:00-03:00'}) === 0, 'Fusos equivalentes');
    const criarBanco = nome => {
      const db = new Dexie(nome);
      db.version(1).stores({pastos:'id,nome',lotes:'id,nome,categoria',eventos:'id,loteId,tipo,data,pastoId,[loteId+data]',chuvas:'id,data,mm',fila_sync:'++seq,tabela,registroId,criadoEm'});
      return db;
    };
    const a = criarBanco('sync-teste-A');
    const b = criarBanco('sync-teste-B');
    const nuvem = criarSupabaseMock({limiteServidor: 100});
    let onlineA = false, onlineB = false;
    let relogio = Date.parse('2026-09-26T12:00:00Z');
    const sA = criarSincronizador({db:a,cliente:nuvem,online:()=>onlineA,agora:()=>relogio});
    const sB = criarSincronizador({db:b,cliente:nuvem,online:()=>onlineB,agora:()=>relogio});
    const lote = crypto.randomUUID(), pasto = crypto.randomUUID(), inicial = crypto.randomUUID();
    const fases = [];
    const estados = [];
    const sair = sA.subscribeSyncStatus(()=>estados.push(sA.getSyncStatus().estado));
    try {
      await a.transaction('rw', a.pastos,a.lotes,a.eventos,a.fila_sync,async()=>{
        await sA.salvarRegistro('pastos',{id:pasto,nome:'Pasto A'});
        await sA.salvarRegistro('lotes',{id:lote,nome:'Lote A',categoria:'Novilhos'});
        await sA.salvarRegistro('eventos',{id:inicial,loteId:lote,pastoId:pasto,tipo:'inicial',qtd:10,data:'2026-09-26'});
      });
      conferir(await a.fila_sync.count() === 3, 'Fila offline atômica');
      const novo = await a.lotes.get(lote);
      conferir(novo.criadoEm && novo.atualizadoEm, 'Datas automáticas');
      onlineA = true; onlineB = true;
      await sA.sincronizarTudo(); await sB.sincronizarTudo();
      conferir((await b.lotes.get(lote)).nome === 'Lote A', 'A → nuvem → B');
      conferir((await b.eventos.get(inicial)).pastoId === pasto, 'Conversão de chaves estrangeiras');
      igual(nuvem.chamadas.filter(c=>c.tipo==='rpc').map(c=>c.tabela), ['pastos','lotes','eventos'], 'Ordem das dependências');
      fases.push('A');

      const peso = crypto.randomUUID();
      onlineB = false; relogio += 1000;
      await sB.salvarRegistro('eventos',{id:peso,loteId:lote,tipo:'pesagem',peso:340,data:'2026-09-26'});
      onlineB = true; await sB.sincronizarTudo(); await sA.sincronizarTudo();
      conferir((await a.eventos.get(peso)).peso === 340, 'B → nuvem → A'); fases.push('B');

      onlineA = false; relogio += 1000;
      const chuva = crypto.randomUUID();
      await sA.salvarRegistro('chuvas',{id:chuva,data:'2026-09-26',mm:18.5});
      a.close(); await a.open();
      conferir((await a.chuvas.get(chuva)).mm === 18.5 && await a.fila_sync.count() === 1, 'Persistência após reabrir');
      onlineA = true; await sA.sincronizarTudo(); await sB.sincronizarTudo();
      conferir((await b.chuvas.get(chuva)).mm === 18.5, 'Chuva offline enviada'); fases.push('C');

      onlineA = false; relogio += 1000;
      await sA.salvarRegistro('lotes',{id:lote,nome:'Local novo'});
      nuvem.controle.falharEnvio = true;
      onlineA = true; await sA.sincronizarTudo();
      conferir((await a.lotes.get(lote)).nome === 'Local novo', 'Download antigo não pode substituir local pendente');
      conferir(await a.fila_sync.count() === 1, 'Pendência local mais recente mantida');
      const remoto = nuvem.tabelas.lotes.get(lote);
      nuvem.tabelas.lotes.set(lote,{...remoto,nome:'Remoto novo',atualizado_em:new Date(relogio+1000).toISOString()});
      await sA.sincronizarTudo();
      conferir((await a.lotes.get(lote)).nome === 'Remoto novo' && await a.fila_sync.count() === 0, 'Remoto novo vence e remove pendência obsoleta');
      conferir(sA.getSyncStatus().conflitos === 1, 'Conflito exposto');
      nuvem.controle.falharEnvio = false;
      onlineA = false; relogio += 2000;
      await sA.salvarRegistro('lotes',{id:lote,nome:'Local antigo no envio'});
      nuvem.tabelas.lotes.set(lote,{...remoto,nome:'Servidor mais recente',atualizado_em:new Date(relogio+1000).toISOString()});
      onlineA = true; await sA.sincronizarTudo();
      conferir(nuvem.tabelas.lotes.get(lote).nome === 'Servidor mais recente', 'Envio não sobrescreve servidor novo');
      conferir((await a.lotes.get(lote)).nome === 'Servidor mais recente', 'RPC devolve vencedor');
      onlineA = false; relogio += 2000;
      await sA.salvarRegistro('lotes',{id:lote,nome:'Empate local'});
      const empatado = await a.lotes.get(lote);
      nuvem.tabelas.lotes.set(lote,{...paraSupabase('lotes',empatado),nome:'Empate remoto'});
      onlineA = true; await sA.sincronizarTudo();
      conferir((await a.lotes.get(lote)).nome === 'Empate remoto', 'Empate converge para servidor'); fases.push('D');

      onlineA = false; relogio += 1000;
      await sA.salvarRegistro('lotes',{id:lote,nome:'Preservar em erro'});
      nuvem.controle.falharEnvio = true; nuvem.controle.falharLeitura = true;
      onlineA = true; await sA.sincronizarTudo();
      conferir((await a.lotes.get(lote)).nome === 'Preservar em erro' && await a.fila_sync.count() === 1, 'Falha não perde dados');
      conferir(sA.getSyncStatus().estado === 'erro' && sA.getSyncStatus().erro, 'Erro recuperável exposto');
      nuvem.controle.falharEnvio = false; nuvem.controle.falharLeitura = false; fases.push('E');

      const antes = nuvem.chamadas.filter(c=>c.tipo==='rpc').length;
      const execucoes = Array.from({length:20},()=>sA.sincronizarTudo());
      conferir(execucoes.every(p=>p === execucoes[0]), 'Uma promessa para chamadas simultâneas');
      await Promise.all(execucoes);
      conferir(nuvem.chamadas.filter(c=>c.tipo==='rpc').length === antes+1, 'Sem envio duplicado');
      conferir(await a.fila_sync.count() === 0, 'Fila confirmada'); fases.push('F');

      // Edição durante o pedido: uma resposta antiga não confirma a nova fila.
      onlineA = false; relogio += 1000;
      await sA.salvarRegistro('lotes',{id:lote,nome:'Em trânsito'});
      let entrou, liberar;
      const iniciou = new Promise(r=>entrou=r), pausa = new Promise(r=>liberar=r);
      nuvem.controle.antesEnvio = async()=>{ entrou(); await pausa; };
      onlineA = true;
      const voo = sA.sincronizarTudo(); await iniciou;
      relogio += 1000;
      await sA.salvarRegistro('lotes',{id:lote,nome:'Editado durante envio'});
      nuvem.controle.antesEnvio = null; liberar(); await voo;
      conferir(nuvem.tabelas.lotes.get(lote).nome === 'Editado durante envio', 'Reenvio de nova edição sem polling');
      conferir(await a.fila_sync.count() === 0, 'Novas sequências confirmadas corretamente');

      // Dois aparelhos alteram o mesmo registro antes de enviar.
      await sB.sincronizarTudo(); onlineA = false; onlineB = false;
      relogio += 1000; await sA.salvarRegistro('lotes',{id:lote,nome:'Concorrente A'});
      relogio += 1000; await sB.salvarRegistro('lotes',{id:lote,nome:'Concorrente B'});
      onlineA = true; onlineB = true;
      await Promise.all([sA.sincronizarTudo(), sB.sincronizarTudo()]);
      await sA.sincronizarTudo(); await sB.sincronizarTudo();
      conferir((await a.lotes.get(lote)).nome === 'Concorrente B' && (await b.lotes.get(lote)).nome === 'Concorrente B', 'Dois envios concorrentes convergem');

      // Campos antigos: data de fila, não hora do download.
      const legado = crypto.randomUUID();
      await a.lotes.put({id:legado,nome:'Legado offline',categoria:'Bois'});
      await a.fila_sync.add({tabela:'lotes',registroId:legado,criadoEm:'2025-01-02T00:00:00Z'});
      await sA.sincronizarTudo();
      conferir((await a.lotes.get(legado)).atualizadoEm === '2025-01-02T00:00:00Z', 'Timestamp legado estável');
      conferir(doSupabase('pastos',{id:'sem-data',nome:'Antigo'}).atualizadoEm.startsWith('1970'), 'Legado remoto compatível');

      // Mais de mil registros e limite do servidor menor que o solicitado.
      for(let i=0;i<1105;i++) {
        const id='00000000-0000-0000-0001-'+String(i).padStart(12,'0');
        nuvem.tabelas.pastos.set(id,{id,nome:'Página '+i,criado_em:'2024-01-01T00:00:00Z',atualizado_em:'2024-01-01T00:00:00Z'});
      }
      await sB.sincronizarTudo();
      conferir(await b.pastos.count() === 1106, 'Download completo paginado');
      conferir(await b.lotes.get(legado), 'Registro legado chega ao segundo aparelho');
      conferir(estados.includes('offline') && estados.includes('sincronizando') && estados.includes('sincronizado') && estados.includes('erro'), 'Todos os estados');
      conferir(!nuvem.chamadas.some(c=>c.tabela==='fila_sync'), 'Fila nunca enviada');
      return fases;
    } finally {
      sair(); await sA.sincronizarTudo(); await sB.sincronizarTudo();
      a.close(); b.close(); await a.delete(); await b.delete();
    }
  })()`);
  assert.deepEqual(resultado, ['A', 'B', 'C', 'D', 'E', 'F']);
  await evaluate(`(() => {
    const criado_em = new Date().toISOString(), atualizado_em = criado_em;
    const lote = crypto.randomUUID(), evento = crypto.randomUUID();
    window.__supabaseMock.tabelas.lotes.set(lote,{id:lote,nome:'Lote vindo de outro aparelho',categoria:'Bois',criado_em,atualizado_em});
    window.__supabaseMock.tabelas.eventos.set(evento,{id:evento,lote_id:lote,tipo:'inicial',data:'2026-09-26',qtd:4,criado_em,atualizado_em});
    window.__envioLiberado = true;
    window.dispatchEvent(new Event('online'));
  })()`);
  await until(`document.querySelector('.tag-num')?.textContent === '14'`);
  await until(`document.querySelector('.sync-status')?.textContent === 'Sincronizado'`);
  console.log('PASS: dois aparelhos, retorno offline, conflitos, falhas, concorrência, edição durante envio, legados e paginação > 1000 registros.');
}
