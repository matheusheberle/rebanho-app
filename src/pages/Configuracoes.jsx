import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Settings } from 'lucide-react';
import { version } from '../../package.json';
import { definirTema, obterPreferenciaTema, observarTema } from '../lib/theme.js';
import { observarCotacao, usarUFDaPropriedade } from '../lib/cotacao.js';
import LocalizacaoPropriedade from '../components/LocalizacaoPropriedade.jsx';
import StatusSincronizacao from '../components/StatusSincronizacao.jsx';
import { Chip, SectionTitle, Voltar } from '../components/UI.jsx';

export default function Configuracoes({ localizacao, pendentes, navegar, avisar }) {
  const tema = useSyncExternalStore(observarTema, obterPreferenciaTema);
  const [dados, setDados] = useState(null), [erro, setErro] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine), [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  useEffect(() => {
    const sub = observarCotacao({ next: valor => { setDados(valor); setErro(''); }, error: () => setErro('Não foi possível ler a referência da cotação. Volte e tente novamente.') });
    const atualizar = () => setOffline(!navigator.onLine);
    window.addEventListener('online', atualizar); window.addEventListener('offline', atualizar);
    return () => { sub.unsubscribe(); window.removeEventListener('online', atualizar); window.removeEventListener('offline', atualizar); };
  }, []);
  async function usarPropriedade() {
    if (enviando.current) return;
    enviando.current = true; setOcupado(true); setErro('');
    try { await usarUFDaPropriedade(); avisar('A cotação usa a UF da propriedade.'); }
    catch { setErro('Não foi possível alterar a referência. Tente novamente.'); }
    finally { enviando.current = false; setOcupado(false); }
  }
  const preferencia = dados?.preferencia;
  return <div className="settings-page">
    <Voltar onClick={() => navegar('home')}>Início</Voltar>
    <h1 className="page-title"><Settings size={28} aria-hidden="true" />Configurações</h1>
    <LocalizacaoPropriedade localizacao={localizacao} navegar={navegar} />
    <section className="settings-section" aria-labelledby="aparencia-titulo">
      <h2 id="aparencia-titulo">Aparência</h2>
      <fieldset><legend className="lbl">Tema</legend><div className="chips">{[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([valor, label]) => <Chip key={valor} ativo={tema === valor} onClick={() => definirTema(valor)}>{label}</Chip>)}</div></fieldset>
      <p className="hint">Sistema acompanha a aparência escolhida no aparelho.</p>
    </section>
    <section className="settings-section settings-market" aria-labelledby="mercado-titulo">
      <SectionTitle id="mercado-titulo" icon="venda">Cotação da arroba</SectionTitle>
      {!dados && !erro ? <p role="status" className="hint">Carregando referência…</p> : <>
        <p><strong>{preferencia ? `${preferencia.nome} (${preferencia.uf})` : 'UF ainda não configurada'}</strong></p>
        <p className="hint">{preferencia?.origem === 'propriedade' ? 'Usando UF da propriedade.' : preferencia ? `UF comercial escolhida separadamente${localizacao?.uf && localizacao.uf !== preferencia.uf ? ` da propriedade (${localizacao.uf})` : ''}.` : 'Configure a localização da propriedade ou escolha uma UF comercial.'}</p>
        <div className="settings-actions">
          {localizacao?.uf && <button className="btn ghost" disabled={ocupado || preferencia?.origem === 'propriedade'} onClick={usarPropriedade}>{ocupado ? 'Salvando…' : 'Usar UF da propriedade'}</button>}
          <button className="linkbtn" disabled={ocupado} onClick={() => navegar('cotacao')}>Alterar UF comercial</button>
        </div>
        {preferencia && (offline || dados?.estado?.erro) && <details className="quote-options"><summary>Mais opções</summary><button className="linkbtn" onClick={() => navegar('cotacao', null, 'valor')}>Informar valor manualmente</button></details>}
      </>}
      {erro && <p className="erro" role="alert">{erro}</p>}
    </section>
    <section className="settings-section" aria-labelledby="dados-titulo">
      <h2 id="dados-titulo">Sincronização</h2>
      <StatusSincronizacao pendentes={pendentes} detalhado />
      <p className="hint">Os registros são salvos primeiro neste aparelho e sincronizados com a nuvem quando houver internet.</p>
    </section>
    <section className="settings-section" aria-labelledby="sobre-titulo">
      <h2 id="sobre-titulo">Sobre o Rebanho</h2><p>Rebanho · Versão {version}</p>
      <p className="hint">Depois do primeiro acesso com internet, você pode abrir o app e registrar dados sem sinal. Clima e cotação mostram os últimos dados disponíveis.</p>
    </section>
  </div>;
}
