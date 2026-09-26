export const CATEGORIAS = ['Bezerros', 'Novilhos', 'Bois', 'Vacas', 'Touros'];
export const CORES = { Bezerros: '#B7D66B', Novilhos: '#79A94F', Bois: '#3E7A4B', Vacas: '#C99A66', Touros: '#7A5638' };
export const TIPOS = {
  compra: { nome: 'Compra', dica: 'Entrou gado comprado' },
  nascimento: { nome: 'Nascimento', dica: 'Nasceram bezerros' },
  venda: { nome: 'Venda', dica: 'Saiu gado vendido' },
  morte: { nome: 'Morte', dica: 'Perda de animais' },
  troca: { nome: 'Mudança de potreiro', dica: 'O lote mudou de potreiro' },
  pesagem: { nome: 'Pesagem', dica: 'Peso médio do lote' },
  vacina: { nome: 'Vacina ou remédio', dica: 'Sanidade e prazo de carência' },
  monta: { nome: 'Monta ou inseminação', dica: 'Período de cobertura das vacas' },
  prenhez: { nome: 'Diagnóstico de gestação', dica: 'Quantas vacas estão prenhas' }
};
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dataFormatada(data) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
}
export function numero(valor, casas = 0) {
  return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}
export function nomePasto(id, pastos) {
  return pastos.find(p => p.id === id)?.nome || 'Potreiro não informado';
}
