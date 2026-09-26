import React, { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { excluirRegistro, desfazerExclusao } from '../lib/manutencao.js';

export default function AcoesRegistro({ tabela, registro, editar, avisar, depoisExcluir }) {
  const dialog = useRef(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function excluir() {
    setOcupado(true);
    try {
      const excluido = await excluirRegistro(tabela, registro);
      dialog.current.close();
      avisar({ texto: 'Registro excluído', acao: async () => {
        try { await desfazerExclusao(tabela, excluido); avisar('Exclusão desfeita.'); }
        catch (e) { avisar(e.message); }
      } });
      depoisExcluir?.();
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  }
  return <div className="record-actions">
    <button type="button" className="linkbtn" aria-label="Editar registro" title="Editar" onClick={editar}><Pencil size={18} /></button>
    <button type="button" className="linkbtn" aria-label="Excluir registro" title="Excluir" onClick={() => { setErro(''); dialog.current.showModal(); }}><Trash2 size={18} /></button>
    <dialog ref={dialog} className="confirm-dialog" aria-label="Confirmar exclusão">
      <h2>{tabela === 'lotes' ? `Excluir ${registro.nome}?` : 'Excluir registro?'}</h2>
      <p>{tabela === 'lotes' ? 'Esse lote e seu histórico deixarão de aparecer nos aparelhos.' : 'Este registro deixará de aparecer nos aparelhos. Você poderá desfazer logo após excluir.'}</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="dialog-actions"><button className="btn ghost" disabled={ocupado} onClick={() => dialog.current.close()}>Cancelar</button><button className="btn" disabled={ocupado} onClick={excluir}>{tabela === 'lotes' ? 'Excluir lote' : 'Excluir registro'}</button></div>
    </dialog>
  </div>;
}
