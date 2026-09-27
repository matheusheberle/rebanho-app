import React, { useEffect, useRef, useState } from 'react';
import { buscarLocalidades } from '../lib/weather.js';
import { salvarPropriedade } from '../lib/propriedade.js';
import { ESTADOS } from '../lib/estados.js';
import { CapturarLocalizacao } from '../components/LocalizacaoPropriedade.jsx';
import { Icon, PageTitle, Voltar } from '../components/UI.jsx';

export default function ConfigurarLocalizacao({ localizacao, navegar, avisar, tipoInicial, registroEdicao }) {
  const [draft, setDraft] = useState(registroEdicao || localizacao || null);
  const [manual, setManual] = useState(tipoInicial === 'manual');
  const [busca, setBusca] = useState(''), [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false), [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const consulta = useRef(null), ocupado = useRef(false);
  useEffect(() => () => consulta.current?.abort(), []);
  const alterar = (campo, valor) => { setDraft(d => ({ ...d, [campo]: valor })); setErro(''); };
  async function pesquisar(e) {
    e.preventDefault(); consulta.current?.abort();
    const controller = new AbortController(); consulta.current = controller;
    setBuscando(true); setResultados(null); setErro('');
    try {
      const locais = await buscarLocalidades(busca, { signal: controller.signal });
      if (!controller.signal.aborted) setResultados(locais);
    } catch {
      if (!controller.signal.aborted) setErro('Não foi possível buscar localidades. Tente novamente com conexão. Sua localização salva foi mantida.');
    } finally { if (!controller.signal.aborted) setBuscando(false); }
  }
  async function salvar(e) {
    e.preventDefault(); if (ocupado.current) return;
    ocupado.current = true; setSalvando(true); setErro('');
    try {
      const coordenada = valor => typeof valor === 'number' ? valor : /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(String(valor).trim()) ? Number(String(valor).trim().replace(',', '.')) : NaN;
      await salvarPropriedade({ ...draft, latitude: coordenada(draft.latitude), longitude: coordenada(draft.longitude) });
      avisar('Localização da propriedade salva neste aparelho.'); navegar('home');
    } catch (e) { setErro(e.message || 'Não foi possível salvar. Tente novamente.'); }
    finally { ocupado.current = false; setSalvando(false); }
  }
  return <>
    <Voltar onClick={() => navegar('home')}>Início</Voltar><PageTitle icon="localizacao">Localização da propriedade</PageTitle>
    <p className="hint">Confira se o local é o da propriedade antes de salvar. Ele será usado para clima e referência regional da arroba até você alterá-lo.</p>
    {!salvando && (!manual ? <CapturarLocalizacao onSelecionar={local => { setDraft(local); setErro(''); }} onManual={() => setManual(true)} /> : <>
      <form onSubmit={pesquisar}>
        <label className="lbl" htmlFor="local-busca">Cidade ou localidade</label>
        <input id="local-busca" className="input" required minLength={2} value={busca} onChange={e => { consulta.current?.abort(); setBuscando(false); setResultados(null); setBusca(e.target.value); }} />
        <button className="btn ghost section-action" disabled={buscando}><Icon nome="buscar" />{buscando ? 'Buscando…' : 'Buscar localidade'}</button>
      </form>
      <button className="linkbtn" onClick={() => { consulta.current?.abort(); setBuscando(false); setManual(false); }}>Usar GPS em vez da busca</button>
      {resultados && <div aria-live="polite">{resultados.length ? <ul className="list">{resultados.map((l, i) => <li key={`${l.latitude}-${l.longitude}-${i}`}><button className="row" onClick={() => { setDraft(l); setErro(''); setResultados(null); }}><span className="row-main"><strong>{l.nome}</strong></span></button></li>)}</ul> : <p className="hint">Nenhuma localidade encontrada. Tente outro nome.</p>}</div>}
      <p className="hint">Busca: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo / GeoNames</a>. A busca usa uma referência da localidade, não a posição exata da propriedade.</p>
    </>)}
    {erro && <p className="erro" role="alert">{erro}</p>}
    {draft && <form onSubmit={salvar}><fieldset disabled={salvando}>
      <h2>Confirmar localização</h2>
      {draft.aviso && <p className="hint" role="status">{draft.aviso}</p>}
      <label className="lbl" htmlFor="local-nome">Nome da localização</label><input id="local-nome" className="input" required value={draft.nome || ''} onChange={e => alterar('nome', e.target.value)} />
      <label className="lbl" htmlFor="local-municipio">Município ou localidade (se conhecido)</label><input id="local-municipio" className="input" value={draft.municipio || ''} onChange={e => alterar('municipio', e.target.value)} />
      <label className="lbl" htmlFor="local-uf">UF da propriedade</label><select id="local-uf" className="input" value={draft.uf || ''} onChange={e => alterar('uf', e.target.value || null)}><option value="">Não identificada</option>{Object.entries(ESTADOS).map(([uf, nome]) => <option key={uf} value={uf}>{nome} ({uf})</option>)}</select>
      {!draft.uf && <p className="hint">Selecione a UF para consultar a arroba automaticamente. Você também pode salvar apenas a localização para o clima e completar a UF depois.</p>}
      <details className="location-coordinates"><summary>Coordenadas (opcional: conferir ou ajustar)</summary>
        {[['latitude', 'Latitude (−90 a 90)'], ['longitude', 'Longitude (−180 a 180)']].map(([campo, titulo]) => <React.Fragment key={campo}><label className="lbl" htmlFor={`local-${campo}`}>{titulo}</label><input id={`local-${campo}`} className="input" inputMode="text" required value={draft[campo] ?? ''} onChange={e => { setDraft(d => ({ ...d, [campo]: e.target.value, municipio: '', uf: null, aviso: 'Coordenadas alteradas. Confirme novamente município e UF.' })); }} /></React.Fragment>)}
      </details>
      <button className="btn salvar"><Icon nome="salvar" />{salvando ? 'Salvando…' : 'Salvar localização'}</button>
    </fieldset></form>}
  </>;
}
