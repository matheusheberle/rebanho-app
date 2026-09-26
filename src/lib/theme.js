// Preferência exclusiva da interface. Dados do rebanho continuam no Dexie.
const CHAVE = 'rebanho:tema';
let preferencia = 'system';
let tema = 'light';
let sistema;
const ouvintes = new Set();

function lerPreferencia() {
  try {
    const salva = localStorage.getItem(CHAVE);
    return salva === 'light' || salva === 'dark' ? salva : 'system';
  } catch {
    return 'system';
  }
}

function aplicarTema() {
  tema = preferencia === 'system' ? (sistema.matches ? 'dark' : 'light') : preferencia;
  document.documentElement.dataset.theme = tema;
  ouvintes.forEach(ouvinte => ouvinte());
}

export function inicializarTema() {
  if (sistema) return;
  sistema = window.matchMedia('(prefers-color-scheme: dark)');
  preferencia = lerPreferencia();
  aplicarTema();
  // Permanece ativo durante a navegação, mesmo fora da Home.
  sistema.addEventListener('change', () => {
    if (preferencia === 'system') aplicarTema();
  });
  window.addEventListener('storage', event => {
    if (event.key === CHAVE || event.key === null) {
      preferencia = lerPreferencia();
      aplicarTema();
    }
  });
}

export function obterTema() {
  return tema;
}

export function observarTema(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function alternarTema() {
  preferencia = tema === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(CHAVE, preferencia);
  } catch {
    // Mesmo com armazenamento bloqueado, a troca funciona nesta sessão.
  }
  aplicarTema();
}
