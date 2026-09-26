import React from 'react';
import {
  House, Fence, CirclePlus, History, CloudSun, Droplets, Scale, ArrowUpRight,
  ShoppingCart, Sprout, HeartCrack, MoveRight, Syringe, HeartHandshake,
  ClipboardCheck, TriangleAlert, MapPin, ListPlus, ChevronRight, ChevronLeft,
  Check, Search, RefreshCw, Sun, Cloud, CloudFog, CloudDrizzle, CloudRain,
  CloudSnow, CloudLightning, CloudHail, CircleHelp, Tag
} from 'lucide-react';

const ICONES = {
  home: House, lotes: Fence, registrar: CirclePlus, historico: History,
  clima: CloudSun, chuva: Droplets, pesagem: Scale, venda: ArrowUpRight,
  compra: ShoppingCart, nascimento: Sprout, morte: HeartCrack, troca: MoveRight,
  vacina: Syringe, monta: HeartHandshake, prenhez: ClipboardCheck,
  alerta: TriangleAlert, localizacao: MapPin, novoLote: ListPlus, inicial: ListPlus,
  chev: ChevronRight, back: ChevronLeft, salvar: Check, buscar: Search,
  atualizar: RefreshCw, categoria: Tag
};

export default function Icon({ nome, className = '', size = 22 }) {
  const Componente = ICONES[nome] || CircleHelp;
  return <Componente size={size} strokeWidth={1.8} className={`app-icon ${nome === 'chev' ? 'chev' : ''} ${className}`} aria-hidden="true" focusable="false" />;
}

// Apresentação dos códigos WMO retornados pela Open-Meteo.
export function WeatherIcon({ codigo }) {
  let Componente = CircleHelp;
  let descricao = 'Condição indisponível';
  if (codigo === 0) { Componente = Sun; descricao = 'Céu limpo'; }
  else if ([1, 2].includes(codigo)) { Componente = CloudSun; descricao = 'Parcialmente nublado'; }
  else if (codigo === 3) { Componente = Cloud; descricao = 'Encoberto'; }
  else if ([45, 48].includes(codigo)) { Componente = CloudFog; descricao = 'Nevoeiro'; }
  else if ([51, 53, 55].includes(codigo)) { Componente = CloudDrizzle; descricao = 'Garoa'; }
  else if ([56, 57, 66, 67].includes(codigo)) { Componente = CloudHail; descricao = 'Precipitação congelante'; }
  else if ([61, 63, 65, 80, 81, 82].includes(codigo)) { Componente = CloudRain; descricao = 'Chuva'; }
  else if ([71, 73, 75, 77, 85, 86].includes(codigo)) { Componente = CloudSnow; descricao = 'Neve'; }
  else if ([95, 96, 97, 99].includes(codigo)) { Componente = CloudLightning; descricao = 'Trovoadas'; }
  return <span className="weather-symbol" role="img" aria-label={descricao} title={descricao}><Componente size={30} strokeWidth={1.6} aria-hidden="true" focusable="false" /></span>;
}
