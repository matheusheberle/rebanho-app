import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { obterLocalizacaoAtual } from '../lib/propriedade.js';
import { SectionTitle } from './UI.jsx';

export function CapturarLocalizacao({ onSelecionar, onManual }) {
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState('');
  const consulta = useRef(null);
  useEffect(() => () => consulta.current?.abort(), []);
  async function obter() {
    if (consulta.current && !consulta.current.signal.aborted) return;
    const controller = new AbortController(); consulta.current = controller;
    setOcupado(true); setErro('');
    try {
      const local = await obterLocalizacaoAtual({ signal: controller.signal });
      if (!controller.signal.aborted) onSelecionar(local);
    } catch (e) { if (!controller.signal.aborted) setErro(e.message); }
    finally { if (!controller.signal.aborted) { setOcupado(false); consulta.current = null; } }
  }
  return <>
    <p className="hint">Use o GPS somente se estiver na propriedade. O app consulta sua posição uma vez, sem rastreamento em segundo plano.</p>
    <p className="hint">Ao usar o GPS, as coordenadas são enviadas à <a href="https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free" target="_blank" rel="noreferrer">BigDataCloud</a> para identificar município e UF. O serviço usa sinais anônimos de coordenadas e IP para melhorar sua base.</p>
    <button className="btn section-action" type="button" disabled={ocupado} onClick={obter}><LocateFixed size={20} aria-hidden="true" />{ocupado ? 'Obtendo localização…' : erro ? 'Tentar novamente' : 'Usar minha localização'}</button>
    {ocupado && <p className="hint" role="status">Aguarde a localização e a identificação do município.</p>}
    {erro && <p className="erro" role="alert">{erro}</p>}
    <button className="linkbtn" type="button" onClick={() => { consulta.current?.abort(); consulta.current = null; setOcupado(false); onManual(); }}>Escolher manualmente</button>
  </>;
}

export default function LocalizacaoPropriedade({ localizacao, navegar }) {
  return <section className="home-section quiet-section property-section" aria-labelledby="propriedade-titulo">
    <SectionTitle id="propriedade-titulo" icon="localizacao">{localizacao ? 'Localização da propriedade' : 'Configure a localização da propriedade'}</SectionTitle>
    {localizacao ? <>
      <p><strong>{localizacao.municipio ? `${localizacao.municipio}${localizacao.uf ? ` - ${localizacao.uf}` : ''}` : localizacao.nome}</strong></p>
      <p className="hint">{localizacao.uf ? 'Localização salva. Usada para clima e como referência padrão da arroba.' : 'Coordenadas salvas para o clima. Confirme a UF para usar também na arroba.'}</p>
      <button className="linkbtn" onClick={() => navegar('localizacao')}>Atualizar localização</button>
    </> : <>
      <p className="hint">Usaremos essa localização para previsão do tempo e referência regional da arroba.</p>
      <CapturarLocalizacao onSelecionar={local => navegar('localizacao', null, 'gps', local)} onManual={() => navegar('localizacao', null, 'manual')} />
    </>}
  </section>;
}
