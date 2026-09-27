// Opcional: consome UMA requisição no endpoint JSON real, sem dados do rebanho.
import assert from 'node:assert/strict';
import { buscarCotacaoArroba } from '../src/lib/cotacao.js';
const uf=process.argv[2] || 'PR';
const r=await buscarCotacaoArroba(uf);
assert.equal(r.uf,uf); assert.ok(r.valor>0 && r.dataCotacao && r.fonte);
console.log(JSON.stringify(r,null,2));
