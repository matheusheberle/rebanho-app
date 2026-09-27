import React, { useEffect, useRef, useState } from 'react';
import { ESTADOS, lerCotacaoSelecionada, salvarPreferenciaCotacao, salvarCotacaoManual, usarUFDaPropriedade } from '../lib/cotacao.js';
import { hojeISO } from '../lib/apresentacao.js';
import { PageTitle, Voltar } from '../components/UI.jsx';

export default function ConfigurarCotacao({tipoInicial,navegar,avisar}) {
  const [dados,setDados]=useState(null), [uf,setUf]=useState(''), [valor,setValor]=useState(''), [data,setData]=useState(hojeISO());
  const [erro,setErro]=useState(''), [salvando,setSalvando]=useState(false);
  const ocupado=useRef(false);
  useEffect(()=>{
    let ativo=true;
    lerCotacaoSelecionada().then(d=>{if(ativo){setDados(d);setUf(d.preferencia?.uf || '');}}).catch(()=>{if(ativo)setErro('Não foi possível abrir a configuração. Volte e tente novamente.');});
    return ()=>{ativo=false;};
  },[]);
  const manual=tipoInicial==='valor' && dados?.preferencia;
  const permitirManual=manual && (!navigator.onLine || dados.estado?.erro);
  async function usarPropriedade() {
    if(ocupado.current)return;
    ocupado.current=true;setSalvando(true);setErro('');
    try { await usarUFDaPropriedade(); avisar('A arroba usa novamente a UF da propriedade.'); navegar('home'); }
    catch { setErro('Não foi possível alterar a referência. Tente novamente.'); }
    finally { ocupado.current=false;setSalvando(false); }
  }
  async function salvar(e) {
    e.preventDefault(); if(ocupado.current)return;
    ocupado.current=true;setSalvando(true);setErro('');
    try {
      if(manual) await salvarCotacaoManual(uf,{valor,data}); else await salvarPreferenciaCotacao(uf);
      avisar(manual?'Valor manual salvo neste aparelho.':'Região salva. A cotação será consultada automaticamente.');navegar('home');
    }catch(e){setErro(e.message);}finally{ocupado.current=false;setSalvando(false);}
  }
  return <><Voltar onClick={()=>navegar('home')}>Início</Voltar><PageTitle icon="venda">{manual?'Informar valor manualmente':'Região da arroba'}</PageTitle>
    {!dados ? <p role="status">{erro || 'Carregando…'}</p> : manual && !permitirManual ? <p className="hint">A consulta automática está disponível. Use Atualizar na Home.</p> : <form className="cotacao-form" onSubmit={salvar}><fieldset disabled={salvando}>
      {manual ? <><p className="hint">{ESTADOS[uf]} · alternativa enquanto a consulta automática estiver indisponível. Uma consulta bem-sucedida volta ao valor automático.</p>
        <label className="lbl" htmlFor="cotacao-valor">Valor em R$/@</label><input id="cotacao-valor" className="input" inputMode="decimal" required value={valor} onChange={e=>setValor(e.target.value)} />
        <label className="lbl" htmlFor="cotacao-data">Data do valor informado</label><input id="cotacao-data" className="input" type="date" required max={hojeISO()} value={data} onChange={e=>setData(e.target.value)} />
      </> : <><p className="hint">Normalmente usamos a UF da propriedade. Esta opção permite escolher outra referência comercial, sem mudar a localização do clima. Ao salvar uma nova localização, a referência volta a acompanhar a propriedade.</p>{dados.propriedade?.uf && <button type="button" className="btn ghost section-action" onClick={usarPropriedade}>Usar UF da propriedade ({dados.propriedade.uf})</button>}<label className="lbl" htmlFor="cotacao-uf">Qual estado usar como referência para a cotação?</label><select id="cotacao-uf" className="input" required value={uf} onChange={e=>setUf(e.target.value)}><option value="">Escolha o estado</option>{Object.entries(ESTADOS).map(([sigla,nome])=><option key={sigla} value={sigla}>{nome} ({sigla})</option>)}</select></>}
      {erro && <p className="erro" role="alert">{erro}</p>}<button className="btn salvar">{salvando?'Salvando…':manual?'Salvar valor manual':'Salvar região'}</button>
    </fieldset></form>}
  </>;
}
