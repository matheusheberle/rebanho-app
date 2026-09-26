import { db, novoId } from './db.js';
import { salvarRegistro } from './sync.js';
import { saldoDoLote } from './calc.js';
import { validarLeitura } from './chuva.js';
import { compararVersoes } from './sync-records.js';
import { categoriasDoLote } from './categorias.js';
import { conferirNomePasto, usoDoPasto, conferirDestinoAtual } from './pastos.js';

export const ativos = registros => registros.filter(r => !r.excluidoEm);
export function dadosAtivos(dados) {
  const lotes = ativos(dados.lotes), ids = new Set(lotes.map(l => l.id));
  return { ...dados, lotes, pastosHistorico: dados.pastos, pastos: ativos(dados.pastos), chuvas: ativos(dados.chuvas), eventos: ativos(dados.eventos).filter(e => ids.has(e.loteId)) };
}

export function validarHistorico(loteId, eventos) {
  // O app registra dias, não horários dos acontecimentos: confere o saldo
  // ao final de cada dia, sem inventar uma ordem por UUID dentro do dia.
  const dias = [...new Set(ativos(eventos).filter(e => e.loteId === loteId).map(e => e.data))].sort();
  for (const dia of dias) {
    if (saldoDoLote(loteId, ativos(eventos).filter(e => e.data <= dia)) < 0)
      throw new Error(`A quantidade informada é maior que o saldo disponível no histórico (${dia}). Corrija os registros relacionados primeiro.`);
  }
}

export function conferirVersao(atual, esperado) {
  if (!atual || atual.excluidoEm) throw new Error('Este registro foi excluído. Volte à lista para atualizar a tela.');
  if (esperado && compararVersoes(atual, esperado) !== 0)
    throw new Error('Este registro mudou em outro aparelho ou aba. Abra a edição novamente para conferir os valores atuais.');
}

export async function salvarLeitura(registro, anterior) {
  return db.transaction('rw', db.chuvas, db.fila_sync, async () => {
    if (anterior) conferirVersao(await db.chuvas.get(registro.id), anterior);
    const duplicada = ativos(await db.chuvas.where('data').equals(registro.data).toArray()).find(r => r.id !== registro.id);
    if (duplicada) {
      const erro = new Error(`Já existe uma leitura de ${Number(duplicada.mm).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm para esta data.`);
      erro.leitura = duplicada;
      throw erro;
    }
    await salvarRegistro('chuvas', { ...registro, mm: validarLeitura(registro.data, String(registro.mm)) });
  });
}

export async function editarLote(registro, anterior) {
  return db.transaction('rw', db.lotes, db.fila_sync, async () => {
    conferirVersao(await db.lotes.get(registro.id), anterior);
    if (!registro.nome.trim()) throw new Error('Informe o nome do lote.');
    const categorias = categoriasDoLote(registro);
    if (!categorias.length) throw new Error('Selecione pelo menos uma categoria.');
    await salvarRegistro('lotes', { id: registro.id, nome: registro.nome.trim(), categorias });
  });
}

export async function excluirRegistro(tabela, registro) {
  return db.transaction('rw', db[tabela], db.pastos, db.eventos, db.lotes, db.fila_sync, async () => {
    const atual = await db[tabela].get(registro.id);
    conferirVersao(atual, registro);
    if (tabela === 'pastos') {
      const uso = usoDoPasto(atual.id, await db.lotes.toArray(), await db.eventos.toArray());
      if (uso.lotes) throw new Error(`Este pasto está sendo usado por ${uso.lotes} ${uso.lotes === 1 ? 'lote e não pode' : 'lotes e não pode'} ser excluído.`);
    }
    if (tabela === 'eventos') {
      if (atual.tipo === 'inicial') throw new Error('O registro inicial faz parte da criação do lote e não pode ser excluído diretamente.');
      const antes = await db.eventos.where('loteId').equals(atual.loteId).toArray();
      const depois = antes.filter(e => e.id !== atual.id);
      validarHistorico(atual.loteId, depois);
      conferirDestinoAtual(atual.loteId, antes, depois, await db.pastos.toArray());
    }
    await salvarRegistro(tabela, { id: atual.id, excluidoEm: new Date().toISOString() });
    return db[tabela].get(atual.id);
  });
}

export async function desfazerExclusao(tabela, excluido) {
  return db.transaction('rw', db[tabela], db.pastos, db.eventos, db.lotes, db.fila_sync, async () => {
    const atual = await db[tabela].get(excluido.id);
    if (!atual?.excluidoEm || compararVersoes(atual, excluido) !== 0)
      throw new Error('O registro mudou depois da exclusão. Não foi restaurado; confira os dados atualizados.');
    if (tabela === 'pastos') conferirNomePasto(atual.nome, await db.pastos.toArray(), atual.id);
    if (tabela === 'lotes') conferirDestinoAtual(atual.id, [], await db.eventos.where('loteId').equals(atual.id).toArray(), await db.pastos.toArray());
    if (tabela === 'eventos') {
      if ((await db.lotes.get(atual.loteId))?.excluidoEm) throw new Error('O lote está excluído.');
      const antes = await db.eventos.where('loteId').equals(atual.loteId).toArray();
      const depois = antes.map(e => e.id === atual.id ? { ...e, excluidoEm: null } : e);
      validarHistorico(atual.loteId, depois);
      conferirDestinoAtual(atual.loteId, antes, depois, await db.pastos.toArray());
    }
    if (tabela === 'chuvas' && ativos(await db.chuvas.where('data').equals(atual.data).toArray()).length)
      throw new Error('Já existe outra leitura ativa nesta data. A exclusão não foi desfeita.');
    await salvarRegistro(tabela, { id: atual.id, excluidoEm: null });
  });
}

export async function salvarPasto(nome, anterior = null, idNovo = novoId()) {
  return db.transaction('rw', db.pastos, db.fila_sync, async () => {
    if (anterior) conferirVersao(await db.pastos.get(anterior.id), anterior);
    const id = anterior?.id || idNovo;
    const limpo = conferirNomePasto(nome, await db.pastos.toArray(), id);
    await salvarRegistro('pastos', { id, nome: limpo });
    return id;
  });
}
