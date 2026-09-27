// Valida os chunks de produção e o service worker, bloqueando toda rede externa.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { preview } from 'vite';

const profile = await mkdtemp(join(tmpdir(), 'rebanho-pwa-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server, browser, socket;
try {
  server = await preview({ configFile:false, envFile:false, preview:{host:'127.0.0.1',port:5198,strictPort:true} });
  browser = spawn(process.env.BROWSER_PATH, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9338',`--user-data-dir=${profile}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
  let target;
  for (let i=0;i<60;i++) {
    try { target=(await (await fetch('http://127.0.0.1:9338/json')).json()).find(t=>t.type==='page'); } catch {}
    if(target) break;
    await sleep(200);
  }
  assert.ok(target,'Navegador iniciou');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;
  const pending=new Map(), errors=[];
  socket.onmessage=event=>{
    const msg=JSON.parse(event.data);
    if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
    if(pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result);}
  };
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error(`Tempo esgotado: ${expression}`);};
  await command('Runtime.enable'); await command('Page.enable'); await command('Network.enable');
  // Nenhuma consulta à nuvem, às fontes ou às fontes tipográficas durante o teste.
  await command('Network.setBlockedURLs',{urls:['https://*']});
  await command('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
  await command('Page.navigate',{url:'http://127.0.0.1:5198/'});
  await until(`document.querySelector('.tag-num')?.textContent === '0'`);
  await until(`Boolean(navigator.serviceWorker.controller)`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true);
  await command('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await command('Page.reload');
  await until(`document.querySelector('.tag-num')?.textContent === '0'`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Criar primeiro lote').click()`);
  await until(`Boolean(document.querySelector('#lote-nome'))`);
  await evaluate(`(() => { for (const [id,value] of [['lote-nome','Lote offline'],['pasto-nome','Pasto offline'],['quantidade','3']]) { const el=document.getElementById(id); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true})); } })()`);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await until(`document.querySelector('.saldo')?.textContent === '3cabeças'`);
  await command('Page.reload');
  await until(`document.querySelector('.tag-num')?.textContent === '3'`);
  assert.deepEqual(errors,[]);
  console.log('PASS PWA: build de produção, chunks, 320 px, abertura offline pelo service worker, cadastro local e recarga preservando dados. Rede externa bloqueada.');
} finally {
  socket?.close();browser?.kill();
  if(server) await new Promise(resolve=>server.httpServer.close(resolve));
  await sleep(500);
  assert.equal(dirname(resolve(profile)),resolve(tmpdir()));
  assert.ok(basename(profile).startsWith('rebanho-pwa-'));
  await rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
