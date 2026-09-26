# Pastos e categorias da Home

## Uso

A Home mostra **Categorias do rebanho** como badges com o estilo dos chips existentes.
São rótulos, sem clique, contagens ou percentuais. Quebram linha no celular e usam as cores
dos temas. O total do rebanho continua sendo calculado pelos eventos, sem alteração.
Sem categorias de lotes ativos com saldo, há uma mensagem simples e nenhum badge vazio.

O botão **Pastos e potreiros**, na seção Por potreiro da Home, abre a administração.
A navegação inferior permanece com quatro abas.

Na tela de pastos é possível cadastrar, editar o nome e excluir com confirmação.
A lista informa quantos lotes ativos estão associados atualmente a cada pasto e a soma
dos respectivos saldos, usando `pastoAtualDoLote()` e `saldoDoLote()`, uma vez por lote.
Lote ativo significa não excluído; mesmo um lote de saldo zero impede exclusão do pasto
enquanto continuar associado a ele. Isso evita referências atuais a um local indisponível.

## Nomes e gravações

Os nomes são obrigatórios, com espaços iniciais/finais removidos e espaços consecutivos
reduzidos a um. Duplicidades ativas são comparadas sem distinguir maiúsculas/minúsculas.
Renomear mantém o ID e todas as referências `pastoId`.
Os mesmos controles são aplicados ao criar um potreiro dentro de Novo lote ou Registrar.

Todas as gravações usam `salvarRegistro()` e a fila existente. `criadoEm`/`atualizadoEm`
são preenchidos pelo fluxo central. A edição confere a versão para não sobrescrever
um registro alterado enquanto o formulário estava aberto.

## Exclusão e histórico

Antes da exclusão, uma transação Dexie confere os lotes e eventos ativos atuais.
Se algum lote estiver nesse pasto, a exclusão é bloqueada com a quantidade de lotes em uso.
Se estiver livre, grava `excluidoEm` e oferece **Desfazer** por sete segundos.
Não existe cascade nem remoção física. Desfazer também verifica se o nome não foi
reutilizado por outro pasto ativo.

`dadosAtivos()` fornece duas visões dos mesmos registros Dexie:
- `pastos`: somente ativos, para listas de gestão e opções de formulários;
- `pastosHistorico`: todos, incluindo excluídos, para resolver nomes em histórico e detalhes.

Isso não é um segundo banco ou estado independente. Mudanças de nome continuam reativas.
O histórico mostra nomes de referências iniciais e mudanças de potreiro, mesmo após excluir
o pasto. Registros excluídos não reaparecem como opção para novos lotes ou mudanças.

Também são conferidas alterações/exclusões/restaurações de eventos que mudariam o pasto
atual para um pasto excluído, e a restauração de lote com esse destino. São proteções
diretamente relacionadas à administração de pastos; não alteram cálculos de saldo.

## Banco, SQL e limites

**Nenhuma migration nova ou SQL manual é necessário nesta etapa**, desde que as migrations
anteriores, inclusive soft delete, estejam aplicadas. A estrutura atual já contém todos os campos.
Não houve acesso ou alteração no Supabase remoto, nem publicação no GitHub/Vercel.
`db.js`, migrations, schema SQL, motor de sincronização, `calc.js`, clima, chuva e tema foram preservados.

As validações de nomes e ocupação usam o estado disponível no aparelho. Dois aparelhos offline
podem criar nomes iguais, ou um aparelho pode excluir um pasto enquanto outro associa um lote
a ele. A sincronização continua por ID/timestamp, sem trava global ou índice remoto novo.
Depois de convergir, duplicidades podem ser corrigidas renomeando; um lote associado a pasto
excluído mantém o nome legível e pode ser mudado para um pasto ativo. Não há fusão automática
nem remapeamento de referências. Os aparelhos devem usar a versão atualizada.

Não há lixeira permanente: o desfazer continua restrito ao aviso de sete segundos.
A contagem segue a interpretação atual dos eventos pelo app, sem novo conceito de horário,
ocupação histórica, área ou lotação por hectare.

## Testes

- `npm run build`.
- `node scripts/browser-smoke.mjs` com `BROWSER_PATH`: suítes anteriores e testes novos de
  pastos/badges, IndexedDB real em perfil descartável e transporte Supabase simulado.
- `node scripts/sql-smoke.mjs` com `PGLITE_MODULE`: suíte SQL anterior em PostgreSQL/WASM local.

Cobertura: nomes vazios/duplicados, normalização de espaços, edição, criação/renomeação/
exclusão/desfazer entre dois bancos locais simulando aparelhos, bloqueio de uso atual,
opções de pastos ativos, histórico de pasto excluído, badges, largura de 320 px,
temas claro/escuro e cadastro de pasto pelos formulários existentes.
O aviso anterior de bundle acima de 500 kB permanece; não impede a compilação.

## Arquivos desta etapa

Criados:
- `src/lib/pastos.js`
- `src/pages/Pastos.jsx`
- `scripts/pastures-smoke.mjs`
- `docs/pastos-e-categorias-home.md`

Modificados:
- `src/App.jsx`
- `src/lib/manutencao.js`
- `src/components/Icon.jsx`
- `src/components/BottomNav.jsx`
- `src/components/AcoesRegistro.jsx`
- `src/pages/Home.jsx`
- `src/pages/Historico.jsx`
- `src/pages/Lote.jsx`
- `src/pages/Lotes.jsx`
- `src/pages/NovoLote.jsx`
- `src/pages/Registrar.jsx`
- `src/styles/app.css`
- `scripts/browser-smoke.mjs`
- `scripts/categories-smoke.mjs`
- `scripts/sync-smoke.mjs`

`dist/` foi regenerado pelo build. Nenhuma dependência adicionada.
