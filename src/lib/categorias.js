// Preserva também categorias legadas que não estejam na lista dos formulários.
export function categoriasDoLote(lote = {}) {
  const valores = Array.isArray(lote?.categorias) ? lote.categorias : [lote?.categoria];
  return [...new Set(valores.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean))];
}
export function normalizarLote(lote) {
  const categorias = categoriasDoLote(lote);
  return { ...lote, categorias, categoria: categorias[0] || null };
}
