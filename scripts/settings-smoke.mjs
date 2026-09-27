import assert from 'node:assert/strict';
import { abrirConfiguracoes } from './settings-navigation.mjs';

export async function testarConfiguracoes({ command, evaluate, until, click, fill }) {
  assert.equal(await evaluate(`document.querySelectorAll('.property-section, .quote-settings, .quote-options').length`), 0, 'Home sem controles de configuração');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Sincronizar agora')`), false);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Configurações"]').title`), 'Configurações');
  await abrirConfiguracoes({ evaluate, until, click });
  assert.equal(await evaluate(`document.querySelectorAll('nav button').length`), 4);
  assert.match(await evaluate(`document.querySelector('.settings-page').textContent`), /Sobre o Rebanho.*Versão/s);
  await click('Claro');
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'light');
  await command('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'dark'}] });
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'light', 'Preferência manual prevalece sobre sistema');
  await click('Escuro');
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
  await command('Page.reload');
  await until(`Boolean(document.querySelector('[aria-label="Configurações"]'))`);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark', 'Preferência antiga permanece');
  await abrirConfiguracoes({ evaluate, until, click });
  await click('Sistema');
  await command('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'light'}] });
  await until(`document.documentElement.dataset.theme==='light'`);
  assert.equal(await evaluate(`document.querySelector('.settings-page .chip[aria-pressed="true"]').textContent`), 'Sistema');
  await command('Page.reload');
  await until(`Boolean(document.querySelector('[aria-label="Configurações"]'))`);
  await abrirConfiguracoes({ evaluate, until, click });
  assert.equal(await evaluate(`document.querySelector('.settings-page .chip[aria-pressed="true"]').textContent`), 'Sistema');
  await command('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'dark'}] });
  await until(`document.documentElement.dataset.theme==='dark'`);
  for (const label of ['Claro', 'Escuro']) {
    await click(label);
    await command('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.settings-page button')).filter(b=>b.getClientRects().length).every(b=>b.getBoundingClientRect().height>=44)`),true);
  }
  const gpsAntes = await evaluate('window.__gpsCalls');
  await click('Atualizar localização');
  await until(`Boolean(document.querySelector('#local-nome'))`);
  await fill('local-nome', 'Propriedade configurada');
  await click('Salvar localização');
  await until(`document.querySelector('.location-caption')?.textContent.includes('Propriedade configurada')`);
  assert.equal(await evaluate('window.__gpsCalls'), gpsAntes, 'Configurações não inicia GPS');

  await abrirConfiguracoes({ evaluate, until, click });
  await click('Alterar UF comercial');
  await until(`Boolean(document.querySelector('#cotacao-uf'))`);
  // Voltar retorna ao agrupador, sem perder ou alterar a preferência.
  await click('Configurações');
  await until(`Boolean(document.querySelector('.settings-page'))`);
  await click('Alterar UF comercial');
  await until(`Boolean(document.querySelector('#cotacao-uf'))`);
  await evaluate(`(()=>{const s=document.querySelector('#cotacao-uf');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'MS');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('Salvar região');
  await until(`document.querySelector('.quote-region')?.textContent.includes('Mato Grosso do Sul')`);
  await abrirConfiguracoes({ evaluate, until, click });
  await until(`document.querySelector('.settings-market')?.textContent.includes('separadamente da propriedade (PR)')`);
  await click('Usar UF da propriedade');
  await until(`document.querySelector('.settings-market')?.textContent.includes('Usando UF da propriedade')`);

  await evaluate(`Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));`);
  await until(`document.querySelector('.sync-state')?.textContent.includes('Offline')`);
  assert.equal(await evaluate(`document.querySelector('.sync-details button').disabled`),true);
  await until(`Boolean(document.querySelector('.settings-market .quote-options'))`);
  assert.equal(await evaluate(`document.querySelector('.settings-market .quote-options').open`), false, 'Fallback secundário fechado');
  await evaluate(`delete navigator.onLine;window.dispatchEvent(new Event('online'));`);
  await until(`!document.querySelector('.sync-details button').disabled`);
  await evaluate(`(async()=>{const s=await import('/src/lib/sync.js');window.__settingsSync=[];window.__settingsUnsub=s.subscribeSyncStatus(()=>window.__settingsSync.push(s.getSyncStatus().estado));})()`);
  await click('Sincronizar agora');
  await until(`window.__settingsSync.includes('sincronizando')`);
  await until(`!document.querySelector('.sync-details button').disabled`);
  await evaluate(`window.__settingsUnsub()`);
  await click('Início');
  await until(`Boolean(document.querySelector('.tag-num'))`);
  assert.equal(await evaluate(`document.querySelectorAll('nav button').length`),4);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  console.log('PASS Configurações A–K: entrada/volta, localização, Sistema/Claro/Escuro persistentes, UF comercial/propriedade, sincronização manual/offline, quatro abas e 320 px.');
}
