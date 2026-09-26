import { db } from './db.js';
import { supabase } from './supabase.js';
import { criarSincronizador } from './sync-engine.js';

export { paraSupabase, doSupabase } from './sync-records.js';
const sincronizador = criarSincronizador({ db, cliente: supabase });
export const { salvarRegistro, sincronizarTudo, getSyncStatus, subscribeSyncStatus } = sincronizador;
// Compatibilidade com chamadas existentes; sempre executa envio + download.
export const sincronizar = sincronizarTudo;

export function iniciarSincronizacao() {
  const aoFicarOnline = () => { void sincronizarTudo(); };
  const aoFicarOffline = () => sincronizador.marcarOffline();
  const aoVoltar = () => { if (document.visibilityState === 'visible') void sincronizarTudo(); };
  window.addEventListener('online', aoFicarOnline);
  window.addEventListener('offline', aoFicarOffline);
  document.addEventListener('visibilitychange', aoVoltar);
  void sincronizarTudo();
  return () => {
    window.removeEventListener('online', aoFicarOnline);
    window.removeEventListener('offline', aoFicarOffline);
    document.removeEventListener('visibilitychange', aoVoltar);
  };
}
