# Manutenção e correção de dados

## Aplicação manual no Supabase

No SQL Editor do seu projeto, execute **todo** o arquivo
[`../supabase/migrations/20260926_soft_delete_edicao.sql`](../supabase/migrations/20260926_soft_delete_edicao.sql).
Ele pressupõe que a migration `20260926_sync_bidirecional.sql` já foi aplicada.
Não reaplique migrations antigas depois da nova, pois a antiga define a versão anterior da RPC.

O arquivo novo adiciona `excluido_em timestamptz` a `pastos`, `lotes`, `eventos` e `chuvas`,
e atualiza `public.sincronizar_registro(text,jsonb)` para transportar exclusões e proteger datas de chuva.
**Executar apenas os quatro ALTER TABLE não é suficiente.**
`schema.sql` inclui a versão completa para novas instalações. Migrations antigas foram preservadas.
Nenhuma operação foi executada no Supabase remoto; os testes SQL usam PostgreSQL/WASM local.
Não houve alteração de autenticação, RLS ou permissões das tabelas.

Atualize todos os aparelhos após aplicar o SQL. Versões antigas do aplicativo não filtram excluídos.

## Uso

- No histórico geral ou do lote, use o lápis para editar e a lixeira para excluir.
  Os formulários mantêm ID, tipo e lote do evento. O evento inicial é protegido.
- No detalhe do lote, o lápis permite alterar nome/categoria. A quantidade vem dos eventos.
  A lixeira pede confirmação e esconde o lote e seu histórico em todos os aparelhos.
- Na Home, abra **Ver e corrigir leituras** para editar/excluir chuva.
  Uma segunda leitura local para a mesma data oferece **Cancelar** ou **Editar leitura**.
- Após excluir, use **Desfazer** no aviso, disponível por 7 segundos.
  Se outro aparelho alterou aquele registro após a exclusão, o desfazer é bloqueado para não sobrescrevê-lo.
- Use **Sincronizar agora** junto ao indicador de estado. Há sincronização também no início,
  ao recuperar conexão, ao voltar à aba e ao focar a janela, com a trava existente e sem polling.

## Persistência, validação e conflitos

Exclusão grava `excluidoEm` e uma nova versão `atualizadoEm` via `salvarRegistro()`;
desfazer grava explicitamente `excluidoEm: null`. Não há remoção física nem cascade.
A interface recebe somente registros ativos; eventos de lotes excluídos também são filtrados,
antes dos cálculos. `calc.js` não foi modificado.

Edição de evento e exclusão verificam o saldo acumulado até cada data usando `saldoDoLote()`.
Como os acontecimentos têm data sem horário, a validação considera o fechamento de cada dia,
sem inventar ordem por UUID no mesmo dia. Um saldo final positivo não permite esconder
saldo negativo em uma data anterior. Formulários desatualizados são bloqueados.

O conflito continua sendo last write wins por `atualizadoEm`, inclusive para exclusão/restauração.
A comparação mantém a precisão do timestamp e aceita representações equivalentes de fuso.
Uma edição comum não restaura um registro excluído; a ação explícita de desfazer restaura.
Payloads antigos sem `excluido_em` preservam a marca de exclusão no servidor.

Para chuva, a RPC serializa escritas usando um
[bloqueio transacional do PostgreSQL](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
e rejeita outra leitura ativa para a mesma data. Exclusões de chuva são enviadas antes das leituras ativas.
A migration não escolhe ganhadores nem apaga duplicidades antigas.

## Limitações explícitas

- Dois aparelhos offline podem criar UUIDs diferentes para a mesma data. Ao sincronizar,
  a RPC rejeita o segundo; a leitura pendente é preservada e a versão remota é baixada.
  A Home sinaliza duplicidades e mostra totais **parciais**, sem incluir as datas conflitantes.
  Confira os valores e exclua a leitura incorreta; depois edite a restante, se necessário.
  Isso também resolve duplicidades legadas. Não há soma ou descarte automático.
- A proteção de unicidade de chuva é aplicada pela RPC, não por índice UNIQUE;
  escritas SQL diretas que contornem a RPC podem criar duplicidades. Isso permite migrar
  bancos que já possuam duplicatas sem apagar informações.
- O saldo é validado contra os dados disponíveis no aparelho. Edições simultâneas offline
  em **eventos diferentes** do mesmo lote não constituem uma transação global entre aparelhos;
  podem exigir correção após convergir. LWW resolve versões do mesmo ID.
- Não foi criado administrador de potreiros nem ação de edição/exclusão de pasto.
  A exclusão de pastos é bloqueada no serviço de manutenção.
- Desfazer está disponível no aviso de 7 segundos. Não há lixeira permanente nesta etapa.
- Tombstones permanecem armazenados. Não há limpeza física automática.
- Não houve publicação no GitHub/Vercel nem alteração remota.

## Validação

- `npm run build` — compilação e geração de PWA.
- `node scripts/browser-smoke.mjs` — Edge headless, IndexedDB real em perfil descartável,
  mock Supabase compartilhado entre dois bancos Dexie independentes, sem dados reais.
  Usa `BROWSER_PATH` se o navegador não estiver no local padrão.
- `node scripts/sql-smoke.mjs` — migration e RPC executadas em PostgreSQL/WASM local.
  Usa `PGLITE_MODULE` apontando para uma instalação externa de PGlite;
  nenhuma dependência nova foi adicionada ao aplicativo.

Cobertura: edição de pesagem/venda, saldo histórico inválido, exclusão/desfazer,
propagação de exclusão/restauração entre aparelhos, chuva duplicada/edição/exclusão,
nome e exclusão de lote, edição versus exclusão, fila offline persistente,
reconexão, visibilitychange, focus e sincronização manual. Também foram mantidos os testes
anteriores de clima, temas, migração Dexie com dados, paginação, falhas e concorrência.

O build mantém o aviso de bundle acima de 500 kB; não é erro de compilação.
Os testes não substituem uma conferência em dois aparelhos reais após a aplicação manual do SQL.

## Arquivos desta etapa

Criados:
- `src/lib/manutencao.js`
- `src/components/AcoesRegistro.jsx`
- `src/components/LeiturasChuva.jsx`
- `src/pages/EditarLote.jsx`
- `supabase/migrations/20260926_soft_delete_edicao.sql`
- `scripts/maintenance-smoke.mjs`
- `docs/manutencao.md`

Modificados:
- `src/App.jsx`
- `src/components/BottomNav.jsx`
- `src/lib/sync.js`
- `src/lib/sync-engine.js`
- `src/lib/sync-records.js`
- `src/pages/Home.jsx`
- `src/pages/Historico.jsx`
- `src/pages/Lote.jsx`
- `src/pages/Registrar.jsx`
- `src/pages/RegistrarChuva.jsx`
- `src/styles/app.css`
- `supabase/schema.sql`
- `scripts/browser-smoke.mjs`
- `scripts/weather-smoke.mjs`
- `scripts/sync-smoke.mjs`
- `scripts/supabase-mock.js`
- `scripts/sql-smoke.mjs`

`dist/` foi regenerado pelo build. Não foram alterados `calc.js`, `db.js`, regras de clima,
`chuva.js`, módulos de tema, dependências ou migrations antigas.
