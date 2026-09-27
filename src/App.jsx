import React, { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './lib/db.js';
import { lerPropriedade } from './lib/propriedade.js';
import { iniciarSincronizacao } from './lib/sync.js';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import Pastos from './pages/Pastos.jsx';
import Lotes from './pages/Lotes.jsx';
import Lote from './pages/Lote.jsx';
import Registrar from './pages/Registrar.jsx';
import Historico from './pages/Historico.jsx';
import NovoLote from './pages/NovoLote.jsx';
import RegistrarChuva from './pages/RegistrarChuva.jsx';
import ConfigurarLocalizacao from './pages/ConfigurarLocalizacao.jsx';
import ConfigurarCotacao from './pages/ConfigurarCotacao.jsx';
import './styles/app.css';
import { dadosAtivos } from './lib/manutencao.js';
import EditarLote from './pages/EditarLote.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import StatusSincronizacao from './components/StatusSincronizacao.jsx';

export default function App() {
  const [rota, setRota] = useState({ pagina: 'home', loteId: null, tipo: null, chave: 0 });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const main = useRef(null);

  useEffect(() => {
    const consulta = liveQuery(() => db.transaction('r', [db.lotes, db.eventos, db.pastos, db.fila_sync, db.chuvas, db.configuracoes], async () => ({
      lotes: await db.lotes.toArray(), eventos: await db.eventos.toArray(),
      pastos: await db.pastos.toArray(), pendentes: await db.fila_sync.count(),
      chuvas: await db.chuvas.toArray(), localizacao: await lerPropriedade()
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

  function navegar(pagina, loteId = null, tipo = null, registroEdicao = null) {
    setRota(anterior => ({ pagina, loteId, tipo, registroEdicao, chave: anterior.chave + 1 }));
  }
  const paginas = { configuracoes: Configuracoes, cotacao: ConfigurarCotacao, pastos: Pastos, editarLote: EditarLote, home: Home, lotes: Lotes, lote: Lote, registrar: Registrar, historico: Historico, novoLote: NovoLote, registrarChuva: RegistrarChuva, localizacao: ConfigurarLocalizacao };
  const Pagina = paginas[rota.pagina] || Home;
  return <div className="app">
    {rota.pagina !== 'configuracoes' && <StatusSincronizacao pendentes={dados?.pendentes} />}
    <main ref={main} tabIndex={-1}>
      {erro ? <p className="erro" role="alert">{erro}</p> : !dados ? <p role="status">Carregando rebanho…</p> : <Pagina key={rota.chave} {...dadosAtivos(dados)} registroEdicao={rota.registroEdicao} loteId={rota.loteId} tipoInicial={rota.tipo} navegar={navegar} avisar={setAviso} />}
    </main>
    <BottomNav pagina={rota.pagina} navegar={navegar} />
    {aviso && <div className="toast" role="status"><span>{typeof aviso === 'string' ? aviso : aviso.texto}</span>{aviso.acao && <button onClick={() => { const acao = aviso.acao; setAviso(''); void acao(); }}>Desfazer</button>}<button onClick={() => setAviso('')}>Fechar</button></div>}
  </div>;
}
