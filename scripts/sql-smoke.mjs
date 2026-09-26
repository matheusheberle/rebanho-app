// Validação opcional em PostgreSQL/WASM temporário. Não conecta ao Supabase.
// PGLITE_MODULE aponta para dist/index.js de uma instalação externa ao app.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { paraSupabase } from '../src/lib/sync-records.js';

const modulo = process.env.PGLITE_MODULE;
if (!modulo) throw new Error('Defina PGLITE_MODULE com o caminho de dist/index.js do PGlite instalado em uma pasta de teste.');
const { PGlite } = await import(pathToFileURL(modulo).href);
const pg = new PGlite();
const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260926_sync_bidirecional.sql', import.meta.url), 'utf8');
const maintenance = await readFile(new URL('../supabase/migrations/20260926_soft_delete_edicao.sql', import.meta.url), 'utf8');
const categories = await readFile(new URL('../supabase/migrations/20260926_lotes_multiplas_categorias.sql', import.meta.url), 'utf8');
assert.ok(schema.endsWith(categories), 'Schema e migration nova usam a mesma função');
const idPasto = '00000000-0000-0000-0000-000000000001';
const idLote = '00000000-0000-0000-0000-000000000002';
const idEvento = '00000000-0000-0000-0000-000000000003';
const idChuva = '00000000-0000-0000-0000-000000000004';
const rpc = async (tabela, registro) => (await pg.query(
  'select public.sincronizar_registro($1, $2::jsonb) as registro', [tabela, JSON.stringify(paraSupabase(tabela, registro))]
)).rows[0].registro;
try {
  await pg.exec('create role anon; create role authenticated;');
  const antigo = schema.split('-- Sincronização bidirecional')[0].replace(/,\r?\n\s*atualizado_em timestamptz default now\(\)/g, '');
  await pg.exec(antigo);
  await pg.query("insert into pastos (id,nome,criado_em) values ($1,'Pasto antigo','2024-01-01T00:00:00Z')", [idPasto]);
  await pg.query("insert into lotes (id,nome,categoria,criado_em) values ($1,'Lote antigo','Bois','2024-01-01T00:00:00Z')", [idLote]);
  await pg.query("insert into eventos (id,lote_id,pasto_id,tipo,data,qtd,criado_em) values ($1,$2,$3,'inicial','2024-01-01',10,null)", [idEvento,idLote,idPasto]);
  await pg.query("insert into chuvas (id,data,mm,criado_em) values ($1,'2024-01-01',18.5,'2024-01-01T00:00:00Z')", [idChuva]);
  await pg.exec(migration);
  await pg.exec(migration); // idempotente
  await pg.exec(maintenance);
  await pg.exec(maintenance);
  await pg.exec(categories);
  await pg.exec(categories);
  const antigoLote = (await pg.query('select * from lotes where id=$1', [idLote])).rows[0];
  assert.equal(antigoLote.nome, 'Lote antigo');
  assert.deepEqual(antigoLote.categorias,['Bois']);
  assert.equal(Date.parse(antigoLote.atualizado_em), Date.parse('2024-01-01T00:00:00Z'));
  assert.equal(Date.parse((await pg.query('select atualizado_em from eventos where id=$1',[idEvento])).rows[0].atualizado_em), 0);

  const antigoPayload = {id:idLote,nome:'Não pode vencer',categoria:'Bois',criadoEm:'2023-01-01T00:00:00Z',atualizadoEm:'2023-01-01T00:00:00Z'};
  assert.equal((await rpc('lotes',antigoPayload)).nome, 'Lote antigo');
  const novo = {...antigoPayload,nome:'Mais recente',atualizadoEm:'2026-09-26T12:00:00Z'};
  const vencedor = await rpc('lotes', novo);
  assert.equal(vencedor.nome, 'Mais recente');
  assert.equal(Date.parse(vencedor.criado_em), Date.parse('2024-01-01T00:00:00Z'));
  assert.equal((await rpc('lotes',{...novo,nome:'Empate',atualizadoEm:'2026-09-26T09:00:00-03:00'})).nome, 'Mais recente');
  const datas = {criadoEm:'2026-09-26T12:00:00Z',atualizadoEm:'2026-09-26T12:00:00Z'};
  assert.equal((await rpc('pastos',{id:idPasto,nome:'Pasto atualizado',...datas})).nome, 'Pasto atualizado');
  const evento = await rpc('eventos',{id:idEvento,loteId:idLote,pastoId:idPasto,tipo:'pesagem',peso:350.5,data:'2026-09-26',...datas});
  assert.equal(evento.lote_id,idLote);
  assert.equal(evento.peso,350.5);
  const chuva = await rpc('chuvas',{id:idChuva,data:'2026-09-26',mm:0,obs:'Sem chuva',...datas});
  assert.equal(chuva.mm,0);
  assert.equal((await rpc('chuvas',{id:idChuva,data:'2026-09-26',mm:1.5,obs:null,...datas,atualizadoEm:'2026-09-26T12:00:01Z'})).obs,null);
  const outraChuva = {id:'00000000-0000-0000-0000-000000000005',data:'2026-09-26',mm:12,...datas};
  await assert.rejects(rpc('chuvas',outraChuva), /leitura ativa/);
  const excluido = {...novo, excluidoEm:'2026-09-26T14:00:00Z', atualizadoEm:'2026-09-26T14:00:00Z'};
  assert.ok((await rpc('lotes',excluido)).excluido_em);
  const semExclusao = paraSupabase('lotes',{...novo,atualizadoEm:'2026-09-26T14:01:00Z'});
  delete semExclusao.excluido_em;
  assert.ok((await pg.query('select public.sincronizar_registro($1,$2::jsonb) as r',['lotes',JSON.stringify(semExclusao)])).rows[0].r.excluido_em, 'Payload antigo sem campo não restaura');
  assert.ok((await rpc('lotes',{...novo,atualizadoEm:'2026-09-26T13:58:00Z'})).excluido_em, 'Edição anterior perde para exclusão');
  assert.equal((await rpc('lotes',{...novo,excluidoEm:null,atualizadoEm:'2026-09-26T14:02:00Z'})).excluido_em,null);
  await rpc('chuvas',{id:idChuva,data:'2026-09-26',mm:1.5,...datas,excluidoEm:'2026-09-26T14:00:00Z',atualizadoEm:'2026-09-26T14:00:00Z'});
  assert.equal((await rpc('chuvas',outraChuva)).mm,12, 'Data liberada após soft delete');
  await assert.rejects(rpc('chuvas',{id:idChuva,data:'2026-09-26',mm:1.5,...datas,atualizadoEm:'2026-09-26T15:00:00Z'}), /leitura ativa/, 'Restauração não duplica leitura');
  await assert.rejects(pg.query("select public.sincronizar_registro('fila_sync', '{}'::jsonb)"), /Tabela não sincronizável/);
  await assert.rejects(pg.query("select public.sincronizar_registro('lotes', '{}'::jsonb)"), /obrigatórios/);
  const seguranca = (await pg.query("select prosecdef from pg_proc where proname='sincronizar_registro'")).rows[0];
  assert.equal(seguranca.prosecdef,false);
  await pg.exec('set role anon;');
  await assert.rejects(rpc('lotes',novo), /permission denied/);
  await pg.exec('reset role;');
  await pg.exec('grant select, insert, update on public.pastos,public.lotes,public.eventos,public.chuvas to anon; set role anon;');
  assert.equal((await rpc('lotes',novo)).nome,'Mais recente');
  await pg.exec('reset role;');
  await pg.exec(schema); // novos projetos e reaplicação compatível
  const misto = {...novo,categorias:['Vacas','Bezerros'],atualizadoEm:'2026-09-26T16:00:00Z'};
  assert.deepEqual((await rpc('lotes',misto)).categorias,['Vacas','Bezerros']);
  const legado = {id:idLote,nome:'Cliente legado',categoria:'Touros',atualizado_em:'2026-09-26T17:00:00Z'};
  const retornoLegado=(await pg.query('select public.sincronizar_registro($1,$2::jsonb) as r',['lotes',JSON.stringify(legado)])).rows[0].r;
  assert.deepEqual(retornoLegado.categorias,['Vacas','Bezerros'], 'Cliente antigo não reduz categorias');
  assert.equal(retornoLegado.categoria,'Vacas');
  await assert.rejects(rpc('lotes',{...misto,categorias:[],atualizadoEm:'2026-09-26T18:00:00Z'}), /categoria válida/);
  await pg.exec(categories);
  assert.deepEqual((await pg.query('select categorias from lotes where id=$1',[idLote])).rows[0].categorias,['Vacas','Bezerros'], 'Reaplicar não substitui categorias');
  console.log('PASS SQL: migração com dados, idempotência, quatro tabelas, LWW/empate, FK, nulos e SECURITY INVOKER sem elevação de permissões.');
} finally { await pg.close(); }
