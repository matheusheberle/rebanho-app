// Somente leituras do pluviômetro. Previsões nunca entram nestes cálculos.
export function validarLeitura(data, entrada) {
  const texto = String(entrada).trim();
  const mm = Number(texto.replace(',', '.'));
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(texto) || !Number.isFinite(mm) || mm < 0) {
    throw new Error('Informe uma chuva medida válida, de zero ou mais milímetros.');
  }
  const dia = new Date(`${data}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) {
    throw new Error('Informe uma data válida.');
  }
  return mm;
}

export function totaisDeChuva(chuvas, hoje) {
  function inicio(dias) {
    const data = new Date(`${hoje}T12:00:00Z`);
    data.setUTCDate(data.getUTCDate() - dias + 1);
    return data.toISOString().slice(0, 10);
  }
  function total(dias) {
    const desde = inicio(dias);
    return chuvas.reduce((soma, leitura) => leitura.data >= desde && leitura.data <= hoje
      && Number.isFinite(leitura.mm) && leitura.mm >= 0 ? soma + leitura.mm : soma, 0);
  }
  return { hoje: total(1), semana: total(7), mes: total(30) };
}
