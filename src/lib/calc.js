// Todas as funções aqui são puras: recebem lotes/eventos e devolvem
// números ou textos, sem tocar no banco. É a mesma lógica validada
// no protótipo em HTML, só reorganizada em módulos.

export const GESTACAO_DIAS = 285;

// Delta de cabeças que cada tipo de evento representa no saldo do lote.
// Eventos que não mexem em saldo (troca, pesagem, vacina, monta, prenhez)
// simplesmente não entram aqui.
const DELTA = { inicial: 1, compra: 1, nascimento: 1, venda: -1, morte: -1 };

export function saldoDoLote(loteId, eventos) {
  return eventos.reduce((total, e) => {
    if (e.loteId === loteId && DELTA[e.tipo]) {
      return total + DELTA[e.tipo] * e.qtd;
    }
    return total;
  }, 0);
}

function porLoteOrdenado(loteId, eventos) {
  return eventos
    .filter((e) => e.loteId === loteId)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.id.localeCompare(b.id)));
}

export function pastoAtualDoLote(loteId, eventos) {
  let pastoId = null;
  for (const e of porLoteOrdenado(loteId, eventos)) {
    if (e.pastoId && (e.tipo === 'inicial' || e.tipo === 'troca')) pastoId = e.pastoId;
  }
  return pastoId;
}

export function pesagensDoLote(loteId, eventos) {
  return porLoteOrdenado(loteId, eventos).filter((e) => e.tipo === 'pesagem');
}

function difDias(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function ganhoMedioDiario(loteId, eventos) {
  const p = pesagensDoLote(loteId, eventos);
  if (p.length < 2) return null;
  const a = p[p.length - 2];
  const b = p[p.length - 1];
  const dias = difDias(a.data, b.data);
  return dias > 0 ? (b.peso - a.peso) / dias : null;
}

function addDias(dataISO, n) {
  const [y, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function janelaDePartos(loteId, eventos) {
  const ev = porLoteOrdenado(loteId, eventos);
  const montas = ev.filter((e) => e.tipo === 'monta');
  if (!montas.length) return null;
  const m = montas[montas.length - 1];
  const inicio = addDias(m.data, GESTACAO_DIAS);
  const fim = addDias(m.fim || m.data, GESTACAO_DIAS);
  const diagnosticos = ev.filter((e) => e.tipo === 'prenhez' && e.data >= m.data);
  const esperado = diagnosticos.length ? diagnosticos[diagnosticos.length - 1].qtd : null;
  const corte = addDias(inicio, -20);
  const nascidos = ev
    .filter((e) => e.tipo === 'nascimento' && e.data >= corte)
    .reduce((t, e) => t + e.qtd, 0);
  return { inicio, fim, esperado, nascidos };
}

// Avisos que aparecem na tela inicial: carência de remédio ainda valendo,
// lote sem pesagem recente, e janela de partos próxima ou em andamento.
export function calcularAlertas(lotes, eventos, hojeISO) {
  const out = [];
  for (const lote of lotes) {
    const saldo = saldoDoLote(lote.id, eventos);
    if (saldo <= 0) continue;
    const ev = porLoteOrdenado(lote.id, eventos);

    ev.filter((e) => e.tipo === 'vacina' && e.carencia > 0).forEach((e) => {
      const fimCarencia = addDias(e.data, e.carencia);
      const n = difDias(hojeISO, fimCarencia);
      if (n >= 0) {
        out.push({
          loteId: lote.id,
          ordem: n,
          texto: `${lote.nome}: a carência de ${e.produto} termina ${
            n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`
          }. Não envie para abate antes dessa data.`
        });
      }
    });

    const pesagens = ev.filter((e) => e.tipo === 'pesagem');
    const referencia = pesagens.length ? pesagens[pesagens.length - 1].data : ev[0]?.data;
    if (referencia) {
      const diasSemPesar = difDias(referencia, hojeISO);
      if (diasSemPesar > 45) {
        out.push({
          loteId: lote.id,
          ordem: 1000 + diasSemPesar,
          texto: pesagens.length
            ? `${lote.nome}: sem pesagem há ${diasSemPesar} dias.`
            : `${lote.nome}: ainda não foi pesado (entrou há ${diasSemPesar} dias).`
        });
      }
    }

    const jp = janelaDePartos(lote.id, eventos);
    if (jp) {
      const ateInicio = difDias(hojeISO, jp.inicio);
      const ateFim = difDias(hojeISO, jp.fim);
      const faltam = jp.esperado !== null ? Math.max(0, jp.esperado - jp.nascidos) : 0;
      if (ateInicio > 0 && ateInicio <= 30) {
        out.push({
          loteId: lote.id,
          ordem: ateInicio,
          texto: `${lote.nome}: os partos previstos começam em ${ateInicio} dias. Vale se preparar e observar as vacas mais de perto.`
        });
      } else if (ateInicio <= 0 && ateFim >= 0) {
        out.push({
          loteId: lote.id,
          ordem: 0,
          texto: `${lote.nome}: janela de partos em andamento. ${
            jp.esperado !== null
              ? `Nasceram ${jp.nascidos} de cerca de ${jp.esperado} esperados.`
              : `Nasceram ${jp.nascidos} até agora.`
          }`
        });
      } else if (ateFim < 0 && ateFim >= -45 && faltam > 0) {
        out.push({
          loteId: lote.id,
          ordem: 1,
          texto: `${lote.nome}: a data prevista de parto já passou e ainda faltam cerca de ${faltam} bezerros.`
        });
      }
    }
  }
  return out.sort((a, b) => a.ordem - b.ordem);
}
