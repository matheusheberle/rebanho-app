import React, { useEffect, useRef, useState } from 'react';
import { buscarLocalidades, salvarLocalizacao } from '../lib/weather.js';
import { Icon, PageTitle, Voltar } from '../components/UI.jsx';

export default function ConfigurarLocalizacao({ localizacao, navegar, avisar }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState(null);
  const [nome, setNome] = useState(localizacao?.nome || '');
  const [latitude, setLatitude] = useState(String(localizacao?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(localizacao?.longitude ?? ''));
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const consulta = useRef(null);
  const ocupado = useRef(false);
  useEffect(() => () => consulta.current?.abort(), []);

  async function pesquisar(e) {
    e.preventDefault();
    consulta.current?.abort();
    const controller = new AbortController();
    consulta.current = controller;
    setBuscando(true); setResultados(null); setErro('');
    try {
      const locais = await buscarLocalidades(busca, { signal: controller.signal });
      if (!controller.signal.aborted) setResultados(locais);
    } catch {
      if (!controller.signal.aborted) setErro('Não foi possível buscar localidades. Tente com conexão ou informe as coordenadas abaixo.');
    } finally {
      if (!controller.signal.aborted) setBuscando(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true; setSalvando(true); setErro('');
    try {
      const coordenada = texto => /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(texto.trim()) ? Number(texto.trim().replace(',', '.')) : NaN;
      await salvarLocalizacao({ nome, latitude: coordenada(latitude), longitude: coordenada(longitude) });
      avisar('Localização salva neste aparelho.');
      navegar('home');
    } catch (error) {
      setErro(error.name === 'Error' ? error.message : 'Não foi possível salvar a localização. Tente novamente.');
    } finally {
      ocupado.current = false; setSalvando(false);
    }
  }
  return <>
    <Voltar onClick={() => navegar('home')}>Início</Voltar><PageTitle icon="localizacao">Localização da fazenda</PageTitle>
    <p className="hint">Busque uma cidade ou informe as coordenadas da propriedade.</p>
    <form onSubmit={pesquisar}>
      <label className="lbl" htmlFor="local-busca">Cidade ou localidade</label>
      <input id="local-busca" className="input" required minLength={2} value={busca} onChange={e => { consulta.current?.abort(); setBuscando(false); setResultados(null); setBusca(e.target.value); }} />
      <button className="btn ghost section-action" disabled={buscando || salvando}><Icon nome="buscar" />{buscando ? 'Buscando…' : 'Buscar localidade'}</button>
    </form>
    {resultados && <div aria-live="polite">{resultados.length ? <ul className="list">{resultados.map((l, i) => <li key={`${l.latitude}-${l.longitude}-${i}`}><button className="row" onClick={() => { setNome(l.nome); setLatitude(String(l.latitude)); setLongitude(String(l.longitude)); setErro(''); }}><span className="row-main"><strong>{l.nome}</strong><span>{l.latitude}, {l.longitude}</span></span></button></li>)}</ul> : <p className="hint">Nenhuma localidade encontrada. Tente outro nome ou informe as coordenadas.</p>}</div>}
    <form onSubmit={salvar}><fieldset disabled={salvando}>
      <label className="lbl" htmlFor="local-nome">Nome da localização</label><input id="local-nome" className="input" required value={nome} onChange={e => setNome(e.target.value)} />
      <label className="lbl" htmlFor="local-latitude">Latitude (−90 a 90)</label><input id="local-latitude" className="input" required inputMode="text" placeholder="Ex.: -30,03" value={latitude} onChange={e => setLatitude(e.target.value)} />
      <label className="lbl" htmlFor="local-longitude">Longitude (−180 a 180)</label><input id="local-longitude" className="input" required inputMode="text" placeholder="Ex.: -51,23" value={longitude} onChange={e => setLongitude(e.target.value)} />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="btn salvar"><Icon nome="salvar" />{salvando ? 'Salvando…' : 'Salvar localização'}</button>
    </fieldset></form>
  </>;
}
