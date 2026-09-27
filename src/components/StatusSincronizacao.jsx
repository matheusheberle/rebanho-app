import React, { useSyncExternalStore } from 'react';
import { Cloud, CloudOff, RefreshCw, CircleAlert } from 'lucide-react';
import { getSyncStatus, subscribeSyncStatus, sincronizarTudo } from '../lib/sync.js';
import { supabaseConfigurado } from '../lib/supabase.js';

export default function StatusSincronizacao({ pendentes = 0, detalhado = false }) {
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const mensagens = { offline: 'Offline · dados neste aparelho', sincronizando: 'Sincronizando…', sincronizado: 'Sincronizado', erro: 'Erro ao sincronizar' };
  const status = !supabaseConfigurado ? 'Dados neste aparelho · nuvem não configurada'
    : `${sync.estado === 'sincronizado' && pendentes ? 'Alterações aguardando envio' : mensagens[sync.estado]}${pendentes ? ` · ${pendentes} ${pendentes === 1 ? 'alteração pendente' : 'alterações pendentes'}` : ''}${sync.conflitos ? ` · ${sync.conflitos} ${sync.conflitos === 1 ? 'registro atualizado' : 'registros atualizados'} com a versão da nuvem` : ''}`;
  const Icone = { offline: CloudOff, sincronizando: RefreshCw, sincronizado: Cloud, erro: CircleAlert }[sync.estado];
  return <div className={`sync-status${detalhado ? ' sync-details' : ''}`}>
    <span role="status"><Icone size={15} aria-hidden="true" /> <span className="sync-state">{status}</span></span>
    {detalhado && <button className="btn ghost" disabled={!supabaseConfigurado || sync.estado === 'sincronizando' || sync.estado === 'offline'} onClick={() => void sincronizarTudo()}>Sincronizar agora</button>}
  </div>;
}
