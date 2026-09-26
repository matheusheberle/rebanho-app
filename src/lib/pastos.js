import { pastoAtualDoLote, saldoDoLote } from './calc.js';

export const limparNomePasto = nome => String(nome || '').trim().replace(/\s+/g, ' ');
export function conferirNomePasto(nome, pastos, id) {
  const limpo = limparNomePasto(nome);
  if (!limpo) throw new Error('Informe o nome do pasto.');
  if (pastos.some(p => !p.excluidoEm && p.id !== id && limparNomePasto(p.nome).toLocaleLowerCase('pt-BR') === limpo.toLocaleLowerCase('pt-BR')))
    throw new Error('Já existe um pasto ativo com esse nome. Escolha outro nome ou use o pasto existente.');
  return limpo;
}

export function usoDoPasto(pastoId, lotes, eventos) {
  const validos = eventos.filter(e => !e.excluidoEm);
  const ocupantes = lotes.filter(l => !l.excluidoEm && pastoAtualDoLote(l.id, validos) === pastoId);
  return { lotes: ocupantes.length, cabecas: ocupantes.reduce((total, l) => total + saldoDoLote(l.id, validos), 0) };
}

export function conferirDestinoAtual(loteId, antes, depois, pastos) {
  const anterior = pastoAtualDoLote(loteId, antes.filter(e => !e.excluidoEm));
  const destino = pastoAtualDoLote(loteId, depois.filter(e => !e.excluidoEm));
  if (destino && destino !== anterior && !pastos.some(p => p.id === destino && !p.excluidoEm))
    throw new Error('Esta alteração colocaria o lote em um pasto excluído. Corrija a mudança de potreiro para um pasto ativo primeiro.');
}
