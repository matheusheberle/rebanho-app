// Transporte de teste. Implementa as respostas da RPC e das consultas paginadas.
// Não é importado pelo aplicativo de produção.
export function criarSupabaseMock({ permitir = () => true, limiteServidor = Infinity } = {}) {
  const tabelas = Object.fromEntries(['pastos', 'lotes', 'eventos', 'chuvas'].map(t => [t, new Map()]));
  const chamadas = [];
  const controle = { falharEnvio: false, falharLeitura: false, antesEnvio: null, antesLeitura: null };
  const copiar = valor => structuredClone(valor);
  const erro = () => ({ data: null, error: { message: 'Falha simulada do Supabase' } });
  const timestamp = r => Date.parse(r.atualizado_em || r.criado_em || '1970-01-01T00:00:00Z');
  return {
    tabelas, chamadas, controle,
    rpc(nome, { p_tabela: tabela, p_registro: registro }) {
      return { async abortSignal(signal) {
        chamadas.push({ tipo: 'rpc', tabela, registro: copiar(registro) });
        if (controle.antesEnvio) await controle.antesEnvio(tabela, registro);
        if (signal.aborted || !permitir() || controle.falharEnvio) return erro();
        if (nome !== 'sincronizar_registro' || !tabelas[tabela]) return erro();
        if (tabela === 'eventos' && (!tabelas.lotes.has(registro.lote_id)
          || (registro.pasto_id && !tabelas.pastos.has(registro.pasto_id)))) return erro();
        const atual = tabelas[tabela].get(registro.id);
        if (!atual || timestamp(registro) > timestamp(atual)) {
          if (tabela === 'chuvas' && !registro.excluido_em && [...tabelas.chuvas.values()].some(r => r.id !== registro.id && r.data === registro.data && !r.excluido_em))
            return { data: null, error: { message: 'Já existe uma leitura ativa nesta data. Confira as leituras de chuva no aplicativo.' } };
          tabelas[tabela].set(registro.id, { ...copiar(registro), criado_em: atual?.criado_em || registro.criado_em,
            excluido_em: Object.hasOwn(registro, 'excluido_em') ? registro.excluido_em : atual?.excluido_em ?? null });
        }
        return { data: copiar(tabelas[tabela].get(registro.id)), error: null };
      } };
    },
    from(tabela) {
      let limite = 500;
      let depois = null;
      const query = {
        select() { return query; }, order() { return query; },
        limit(n) { limite = n; return query; },
        gt(_campo, valor) { depois = valor; return query; },
        async abortSignal(signal) {
          chamadas.push({ tipo: 'select', tabela, depois });
          if (!permitir() || controle.falharLeitura || signal.aborted) return erro();
          const dados = [...tabelas[tabela].values()].filter(r => !depois || r.id > depois)
            .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, Math.min(limite, limiteServidor));
          const snapshot = copiar(dados);
          if (controle.antesLeitura) await controle.antesLeitura(tabela, snapshot);
          return { data: snapshot, error: null };
        }
      };
      return query;
    }
  };
}
