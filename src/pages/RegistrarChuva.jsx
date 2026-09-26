import React, { useRef, useState } from 'react';
import { novoId } from '../lib/db.js';
import { salvarLeitura } from '../lib/manutencao.js';
import { validarLeitura } from '../lib/chuva.js';
import { hojeISO } from '../lib/apresentacao.js';
import { Icon, PageTitle, Voltar } from '../components/UI.jsx';

export default function RegistrarChuva({ navegar, avisar, registroEdicao }) {
  const [original] = useState(registroEdicao);
  const [duplicada, setDuplicada] = useState(null);
  const [data, setData] = useState(original?.data || hojeISO());
  const [mm, setMm] = useState(original?.mm ?? '');
  const [obs, setObs] = useState(original?.obs || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ocupado = useRef(false);
  async function salvar(e) {
    e.preventDefault();
    if (ocupado.current) return;
    let valor;
    try { valor = validarLeitura(data, mm); } catch (error) { setErro(error.message); return; }
    ocupado.current = true; setSalvando(true); setErro('');
    try {
      await salvarLeitura({ id: original?.id || novoId(), data, mm: valor, obs: obs.trim() || null, criadoEm: original?.criadoEm || new Date().toISOString() }, original);
      avisar('Leitura de chuva salva neste aparelho.');
      navegar('home');
    } catch (error) {
      setDuplicada(error.leitura || null);
      setErro(error.message || 'Não foi possível salvar a leitura. Seus campos foram mantidos; tente novamente.');
    } finally { ocupado.current = false; setSalvando(false); }
  }
  return <>
    <Voltar onClick={() => navegar('home')}>Início</Voltar><PageTitle icon="chuva">{original ? 'Editar leitura' : 'Registrar chuva'}</PageTitle>
    <p className="hint">Informe a chuva realmente medida no pluviômetro. Mantenha uma única leitura por data, com o total medido naquele dia.</p>
    <form onSubmit={salvar}><fieldset disabled={salvando}>
      <label className="lbl" htmlFor="chuva-data">Data</label><input id="chuva-data" type="date" className="input" required value={data} onChange={e => setData(e.target.value)} />
      <label className="lbl" htmlFor="chuva-mm">Chuva medida em mm</label><div className="suffix"><input id="chuva-mm" className="input" inputMode="decimal" required placeholder="Ex.: 18,5" value={mm} onChange={e => setMm(e.target.value)} /><i>mm</i></div>
      <label className="lbl" htmlFor="chuva-obs">Observação (opcional)</label><input id="chuva-obs" className="input" value={obs} onChange={e => setObs(e.target.value)} />
      {erro && <p className="erro" role="alert">{erro}</p>}{duplicada && <div className="dialog-actions"><button type="button" className="btn ghost" onClick={() => { setDuplicada(null); setErro(''); }}>Cancelar</button><button type="button" className="btn" onClick={() => navegar('registrarChuva', null, null, duplicada)}>Editar leitura</button></div>}
      <button className="btn salvar"><Icon nome="salvar" />{salvando ? 'Salvando…' : 'Salvar leitura'}</button>
    </fieldset></form>
  </>;
}
