# Lotes com múltiplas categorias

## SQL manual e ordem de atualização

Execute **inteiro** no SQL Editor do Supabase:
[`supabase/migrations/20260926_lotes_multiplas_categorias.sql`](../supabase/migrations/20260926_lotes_multiplas_categorias.sql).
Pressupõe que `20260926_soft_delete_edicao.sql` já foi aplicada.
Depois atualize o aplicativo em todos os aparelhos. Não execute migrations antigas depois desta:
elas recriam versões antigas da função de sincronização.

A migration adiciona `lotes.categorias text[]`, preenche os valores ausentes a partir de
`categoria` e atualiza a RPC para receber/devolver arrays. Não remove registros, não muda
IDs, timestamps ou exclusões e não sobrescreve arrays já preenchidos ao reaplicar.
`schema.sql` contém a estrutura completa para novos projetos. Migrations anteriores ficaram intactas.
Não houve execução de SQL remoto, publicação, alteração de autenticação/RLS ou nova dependência.

## Compatibilidade

- O campo principal do app é `categorias: string[]`.
- `categoriasDoLote()` aceita também `categoria` legada. Remove repetidos/espaços vazios,
  preservando categorias históricas não listadas nos formulários.
- A versão 3 do Dexie faz a migração de conteúdo ao abrir o banco existente, convertendo
  `categoria: 'Vacas'` para `categorias: ['Vacas']`, sem apagar o banco nem tocar na fila.
  Não há novos índices. O índice legado foi mantido para reduzir mudanças de estrutura.
- A coluna antiga `categoria` permanece temporariamente. As conversões centralizadas
  enviam nela a primeira categoria como representação de compatibilidade, sem usá-la
  para distribuir cabeças. O mesmo alias é mantido localmente.
- Clientes antigos podem continuar enviando lotes novos com uma categoria. Em lotes
  já existentes, payloads antigos sem `categorias` preservam o array atual no servidor,
  inclusive quando alteram nome/exclusão. Alterações de categoria devem ser feitas no
  app atualizado; isso impede que um cliente antigo reduza um lote misto sem perceber.
- Arrays participam da comparação de conteúdo por valor, sem falsos conflitos por
  referência JavaScript. A estratégia de conflito por `atualizadoEm` foi preservada.

## Interface e cálculos

Novo lote e Editar lote compartilham chips de seleção múltipla com `aria-pressed`.
Pelo menos uma categoria é obrigatória. A lista continua centralizada em `CATEGORIAS`
de `apresentacao.js`: Bezerros, Novilhos, Bois, Vacas e Touros. Não foi adicionada Novilhas.
Valores legados fora dessa lista são exibidos no formulário do próprio lote para não se perderem.

Listas e detalhe mostram as categorias separadas por `·`.
Na Home, o total geral continua vindo dos eventos. O gráfico quantitativo por categoria
foi substituído por **Categorias presentes nos lotes**, sem quantidades ou percentuais.
Só são consideradas categorias de lotes ativos com saldo positivo.
Um lote de 100 cabeças com Vacas e Bezerros continua contribuindo com 100 cabeças,
sem supor quantas pertencem a cada categoria.

Eventos continuam vinculados apenas ao lote. `calc.js`, regras de saldo, clima, chuva,
tema e o comportamento de soft delete não foram modificados.

## Testes

- `npm run build`: compilação e PWA; permanece o aviso anterior de bundle acima de 500 kB.
- `node scripts/browser-smoke.mjs` (com `BROWSER_PATH`): suíte anterior e novos cenários.
  Usa navegador isolado, IndexedDB real e Supabase simulado.
- `node scripts/sql-smoke.mjs` (com `PGLITE_MODULE`): PostgreSQL/WASM local, sem Supabase remoto.

Cobertura: criar lote com uma/duas categorias, impedir seleção vazia, editar preservando
ID e atualizando timestamp, exibir chips selecionados, listagem/detalhe/Home, recarga,
soft delete e desfazer, ida/volta entre dois bancos Dexie independentes, legado sem array,
migração v1→v2→v3 com dados/tombstone/fila, migration SQL idempotente e proteção contra
payload de cliente antigo reduzindo o array. Dois bancos simulam os aparelhos; não houve
validação em dispositivos físicos ou Supabase real.

## Arquivos desta etapa

Criados:
- `src/lib/categorias.js`
- `src/components/CategoriasLote.jsx`
- `supabase/migrations/20260926_lotes_multiplas_categorias.sql`
- `scripts/categories-smoke.mjs`
- `docs/multiplas-categorias.md`

Modificados:
- `src/lib/db.js`
- `src/lib/sync-records.js`
- `src/lib/sync-engine.js`
- `src/lib/manutencao.js`
- `src/components/UI.jsx`
- `src/pages/NovoLote.jsx`
- `src/pages/EditarLote.jsx`
- `src/pages/Lote.jsx`
- `src/pages/Home.jsx`
- `supabase/schema.sql`
- `scripts/browser-smoke.mjs`
- `scripts/sync-smoke.mjs`
- `scripts/sql-smoke.mjs`

`dist/` foi regenerado pelo build.
