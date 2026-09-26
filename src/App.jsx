import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db.js';
import { iniciarSincronizacao, getSyncStatus, subscribeSyncStatus } from './lib/sync.js';
import { supabaseConfigurado } from './lib/supabase.js';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import Lotes from './pages/Lotes.jsx';
import Lote from './pages/Lote.jsx';
import Registrar from './pages/Registrar.jsx';
import Historico from './pages/Historico.jsx';
import NovoLote from './pages/NovoLote.jsx';
import RegistrarChuva from './pages/RegistrarChuva.jsx';
import ConfigurarLocalizacao from './pages/ConfigurarLocalizacao.jsx';
import './styles/app.css';

export default function App() {
  const [rota, setRota] = useState({ pagina: 'home', loteId: null, tipo: null, chave: 0 });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const [aviso, setAviso] = useState('');
  const main = useRef(null);

  useEffect(() => {
    const consulta = liveQuery(() => db.transaction('r', [db.lotes, db.eventos, db.pastos, db.fila_sync, db.chuvas, db.configuracoes], async () => ({
      lotes: await db.lotes.toArray(), eventos: await db.eventos.toArray(),
      pastos: await db.pastos.toArray(), pendentes: await db.fila_sync.count(),
      chuvas: await db.chuvas.toArray(), localizacao: await db.configuracoes.get('localizacao')
    }))).subscribe({ next: valor => { setDados(valor); setErro(''); }, error: () => setErro('Não foi possível abrir os dados locais. Recarregue o aplicativo para tentar novamente.') });
    const pararSincronizacao = iniciarSincronizacao();
    return () => { consulta.unsubscribe(); pararSincronizacao(); };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [rota]);
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(''), 7000);
    return () => clearTimeout(timer);
  }, [aviso]);

  function navegar(pagina, loteId = null, tipo = null) {
    setRota(anterior => ({ pagina, loteId, tipo, chave: anterior.chave + 1 }));
  }
  const paginas = { home: Home, lotes: Lotes, lote: Lote, registrar: Registrar, historico: Historico, novoLote: NovoLote, registrarChuva: RegistrarChuva, localizacao: ConfigurarLocalizacao };
  const Pagina = paginas[rota.pagina] || Home;
  const mensagens = { offline: 'Offline · dados neste aparelho', sincronizando: 'Sincronizando…', sincronizado: 'Sincronizado', erro: 'Não foi possível sincronizar · dados neste aparelho' };
  const status = !supabaseConfigurado ? 'Dados neste aparelho · nuvem não configurada'
    : `${mensagens[sync.estado]}${sync.conflitos ? ` · ${sync.conflitos} atualização(ões) remota(s) prevaleceram` : ''}`;

  return <div className="app">
    <div className="sync-status" role="status" title={sync.erro || undefined}>{status}</div>
    <main ref={main} tabIndex={-1}>
      {erro ? <p className="erro" role="alert">{erro}</p> : !dados ? <p role="status">Carregando rebanho…</p> : <Pagina key={rota.chave} {...dados} loteId={rota.loteId} tipoInicial={rota.tipo} navegar={navegar} avisar={setAviso} />}
    </main>
    <BottomNav pagina={rota.pagina} navegar={navegar} />
    {aviso && <div className="toast" role="status"><span>{aviso}</span><button onClick={() => setAviso('')}>Fechar</button></div>}
  </div>;
}
