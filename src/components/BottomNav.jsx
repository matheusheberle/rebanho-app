import React from 'react';
import { Icon } from './UI.jsx';
export default function BottomNav({ pagina, navegar }) {
  const ativa = ['lote', 'novoLote', 'editarLote'].includes(pagina) ? 'lotes' : ['registrarChuva', 'localizacao'].includes(pagina) ? 'home' : pagina;
  return <nav aria-label="Navegação principal">
    {[['home', 'Início'], ['lotes', 'Lotes'], ['registrar', 'Registrar'], ['historico', 'Histórico']].map(([id, nome]) =>
      <button key={id} className={`nav-i${ativa === id ? ' on' : ''}${id === 'registrar' ? ' reg' : ''}`} aria-current={ativa === id ? 'page' : undefined} onClick={() => navegar(id)}>
        <span className="ic"><Icon nome={id} /></span><span>{nome}</span>
      </button>
    )}
  </nav>;
}
