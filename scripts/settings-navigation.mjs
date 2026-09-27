// Caminho real da interface para os testes que antes acessavam controles na Home.
export async function abrirConfiguracoes({ evaluate, until, click }) {
  if (await evaluate(`Boolean(document.querySelector('.settings-page'))`)) return;
  if (!await evaluate(`Boolean(document.querySelector('[aria-label="Configurações"]'))`)) await click('Início');
  await until(`Boolean(document.querySelector('[aria-label="Configurações"]'))`);
  await evaluate(`document.querySelector('[aria-label="Configurações"]').click()`);
  await until(`Boolean(document.querySelector('.settings-page'))`);
  await until(`Array.from(document.querySelectorAll('.settings-market button')).some(b=>b.textContent==='Alterar UF comercial')`);
}
