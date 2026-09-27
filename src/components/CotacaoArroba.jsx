import React, { useEffect, useState } from 'react';
import { observarCotacao, carregarCotacaoArroba } from '../lib/cotacao.js';
import { dataFormatada } from '../lib/apresentacao.js';
import { SectionTitle } from './UI.jsx';

export default function CotacaoArroba({ navegar }) {
  const [dados,setDados] = useState(null), [erroLocal,setErroLocal] = useState('');
  const [offline,setOffline] = useState(!navigator.onLine), [buscando,setBuscando] = useState(false);
  const uf = dados?.preferencia?.uf;
  useEffect(() => {
    const sub = observarCotacao({next:setDados,error:()=>setErroLocal('Não foi possível ler a cotação salva.')});
    return () => sub.unsubscribe();
  }, []);
  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      setOffline(!navigator.onLine); setBuscando(true);
      try { await carregarCotacaoArroba(); if (ativo) setErroLocal(''); } catch { if (ativo) setErroLocal('Não foi possível atualizar agora.'); }
      finally { if (ativo) setBuscando(false); }
    };
    const voltar = () => { if (document.visibilityState === 'visible') void atualizar(); };
    const ficarOffline = () => setOffline(true);
    void atualizar();
    window.addEventListener('online',atualizar); window.addEventListener('offline',ficarOffline); document.addEventListener('visibilitychange',voltar);
    return () => { ativo=false; window.removeEventListener('online',atualizar); window.removeEventListener('offline',ficarOffline); document.removeEventListener('visibilitychange',voltar); };
  }, [uf]);
  async function atualizar() {
    setBuscando(true); setErroLocal('');
    try { await carregarCotacaoArroba({forcar:true}); } catch { setErroLocal('Não foi possível atualizar agora.'); }
    finally { setBuscando(false); }
  }
  const {preferencia,cotacao,estado={}} = dados || {};
  const fallback = offline || Boolean(estado.erro);
  return <section className="home-section quiet-section quote-section" aria-labelledby="cotacao-titulo">
    <SectionTitle id="cotacao-titulo" icon="venda">Arroba do boi</SectionTitle>
    {preferencia ? <>
      {cotacao ? <><p className="quote-price">{cotacao.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} <span>/ @</span></p>
        <p className="quote-region">Referência: {preferencia.nome} ({preferencia.uf})</p>
        <p className="hint">{cotacao.dataEhAtualizacao ? 'Atualização da fonte em' : 'Atualizado em'} <time dateTime={cotacao.dataCotacao}>{dataFormatada(cotacao.dataCotacao)}</time></p>
        <p className="hint">Fonte: {cotacao.fonte === 'scot_consultoria' ? 'Scot Consultoria' : cotacao.fonte}</p>
        {cotacao.modo === 'manual' && <p className="hint">Valor informado manualmente{cotacao.referenciaLegada ? ` · ${cotacao.referenciaLegada}` : ''}</p>}
        {fallback && <p className="hint" role="status">Última cotação disponível{offline ? ' · offline' : ''}.</p>}
      </> : <><p className="quote-region">Referência: {preferencia.nome} ({preferencia.uf})</p><p className="hint" role="status">{buscando ? 'Buscando cotação…' : 'Cotação indisponível no momento.'}</p></>}
      {estado.erro && !offline && <p className="hint">{estado.erro}</p>}
      <p className="hint"><a href="https://agrodocai.com.br" target="_blank" rel="noreferrer">Cotação via AgroDoc AI · agrodocai.com.br</a></p>
      <div className="quote-actions"><button className="linkbtn" onClick={atualizar} disabled={buscando || offline}>{buscando ? 'Atualizando…' : 'Atualizar'}</button><button className="linkbtn" onClick={()=>navegar('cotacao')}>Alterar região</button></div>
      {fallback && <details className="quote-options"><summary>Mais opções</summary><button className="linkbtn" onClick={()=>navegar('cotacao',null,'valor')}>Informar valor manualmente</button></details>}
    </> : <><p className="hint">Configure sua região para acompanhar a arroba do boi.</p><button className="linkbtn" onClick={()=>navegar('cotacao')}>Escolher região</button></>}
    {erroLocal && <p className="hint" role="status">{erroLocal}</p>}
  </section>;
}
