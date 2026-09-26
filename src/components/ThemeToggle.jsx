import React, { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { alternarTema, obterTema, observarTema } from '../lib/theme.js';

export default function ThemeToggle() {
  const tema = useSyncExternalStore(observarTema, obterTema);
  const label = tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
  const Icone = tema === 'dark' ? Sun : Moon;
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={alternarTema}>
    <Icone size={21} strokeWidth={1.8} aria-hidden="true" focusable="false" />
  </button>;
}
