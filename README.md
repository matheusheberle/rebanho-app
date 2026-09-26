# Rebanho — React/Vite

Versão React/Vite do protótipo, com dados locais em Dexie/IndexedDB.
O aplicativo começa vazio, sem dados de exemplo ou armazenamento da
dados do rebanho em localStorage. O HTML original permanece como referência.

## O que já está pronto

- **`src/lib/db.js`** — banco local no aparelho (Dexie/IndexedDB). É
  onde o app lê e grava no dia a dia, mesmo sem internet.
- **`src/lib/calc.js`** — toda a lógica de cálculo (saldo do lote,
  ganho de peso, avisos, janela de partos), portada do protótipo.
- **`src/lib/supabase.js`** e **`src/lib/sync.js`** — conexão com o
  banco na nuvem e a fila que sincroniza quando a internet volta.
- **`supabase/schema.sql`** — script para criar as tabelas no Supabase.
- **`src/App.jsx`** — navegação por estado, sem React Router, e leitura
  reativa do Dexie com `liveQuery`.
- **`src/pages/Home.jsx`** e **`Lotes.jsx`** — resumo do rebanho,
  categorias, alertas, potreiros e listagem de lotes com saldo e peso.
- **`Lote.jsx`**, **`Registrar.jsx`**, **`Historico.jsx`** e **`NovoLote.jsx`** —
  estrutura conectada, com detalhes, cadastro, registros e consulta por lote.
- **`src/styles/app.css`** — estilos do protótipo, largura máxima de 480px,
  brinco amarelo, navegação inferior e tema escuro conforme o sistema.

Todas as gravações sincronizadas passam por `salvarRegistro()`. Registro e fila são
gravados na mesma transação; cadastro de potreiro, lote e evento inicial
também é atômico. `salvarRegistro()` preenche `criadoEm` e `atualizadoEm`
centralmente, sem exigir mudanças nos formulários. Edições preservam a data
de criação e recebem uma versão crescente por registro.

## Sincronização entre aparelhos

`sincronizarTudo()` envia as pendências de `pastos`, `lotes`, `eventos` e
`chuvas`, depois baixa essas tabelas e insere/atualiza o Dexie por ID.
`liveQuery` atualiza as telas após receber registros. Não apaga tabelas,
não cria uma segunda fonte de dados e nunca envia `fila_sync`, cache ou
configurações locais ao Supabase.

- Executa ao abrir o app, recuperar conexão, voltar ao primeiro plano e
  após salvar. O polling de 30 segundos foi removido; não usa Realtime.
- `sync-records.js` centraliza as conversões de `loteId`, `pastoId`,
  `criadoEm` e `atualizadoEm` nos dois sentidos.
- A RPC `sincronizar_registro` faz o upsert **condicional e atômico** no
  PostgreSQL e retorna a versão vencedora. Isso evita que um envio offline
  antigo sobrescreva a nuvem antes do download. A função usa `SECURITY
  INVOKER`, sem alterar autenticação, RLS ou permissões das tabelas.
- **Last write wins por registro inteiro:** vence o maior `atualizadoEm`.
  Em empate, a versão já confirmada no servidor vence. A comparação local
  preserva a precisão de microssegundos do PostgreSQL. Uma pendência empatada
  no download aguarda a confirmação da RPC antes de ser removida.
- O merge e a remoção de pendências são uma transação Dexie. Uma resposta
  confirma apenas as sequências enviadas; edições mais recentes feitas
  durante a requisição permanecem na fila e disparam outra passagem.
- Chamadas simultâneas compartilham a mesma promessa. Web Locks serializa
  abas que usam o mesmo banco quando disponível; nos demais navegadores,
  gravações remotas idempotentes e transações locais protegem os dados,
  embora abas diferentes possam repetir pedidos de rede.
- O download usa paginação por ID até uma página vazia, inclusive quando
  o limite do Supabase é menor que o solicitado. Não há limite total de
  mil registros. Esta etapa baixa todas as tabelas em cada sincronização.
- Sem conexão/configuração, grava normalmente no aparelho. Falhas mantêm
  as pendências não confirmadas; uma próxima abertura, gravação ou retorno
  ao primeiro plano/conexão tenta novamente. Não existe retry por polling.
- `getSyncStatus()` e `subscribeSyncStatus()` expõem `estado`, `erro`,
  `ultimaSincronizacao` e `conflitos`. Estados: `offline`, `sincronizando`,
  `sincronizado`, `erro`. A faixa superior mostra o estado discretamente e
  informa quando uma edição remota substituiu uma pendência local.

### Compatibilidade e limitações

Não foi necessária uma nova versão ou índice Dexie: campos não indexados
podem ser acrescentados aos objetos existentes. Registros antigos usam
`criadoEm`, ou a data da última pendência quando houver; sem qualquer data,
usam 1970-01-01 como versão mínima. O horário do download não vira uma edição.

Os relógios dos aparelhos precisam estar corretos: LWW não resolve desvio
de relógio entre dispositivos. Não há merge por campo, histórico das versões
perdedoras nem resolução manual; o contador de conflitos vale para a execução
atual. Exclusão/desfazer e `deleted_at` não foram implementados. Apagar uma
linha diretamente na nuvem não a apaga dos aparelhos.

Todos os aparelhos devem usar esta versão. Clientes antigos com upsert
incondicional não têm a proteção da RPC. Edições manuais no SQL Editor devem
atualizar `atualizado_em`; o valor padrão `now()` é apenas para inserções.
Sem Realtime/polling, um aparelho mantido aberto e sem interação receberá
novidades no próximo gatilho. Paginação não é um snapshot global: registros
inseridos durante o download podem aparecer apenas na próxima sincronização.

## Clima e chuva na fazenda

- A previsão usa a [API Open-Meteo](https://open-meteo.com/en/docs), sem API key,
  com `timezone=auto`, sete dias e as variáveis diárias `temperature_2m_max`,
  `temperature_2m_min`, `precipitation_probability_max`, `precipitation_sum`,
  `weather_code` e `wind_speed_10m_max`. A Home exibe aproximadamente seis dias,
  máximas, mínimas e chance de chuva; destaca probabilidades a partir de 60%.
- **Configurar localização** permite buscar cidades pela
  [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) ou informar
  nome, latitude e longitude manualmente. O cadastro manual funciona offline.
- A versão 2 do Dexie acrescenta `chuvas`, `configuracoes` e `clima_cache`,
  sem remover os registros da versão 1. Configuração e cache ficam apenas
  neste aparelho, fora da fila de sincronização.
- O cache é separado por coordenadas e reutilizado por uma hora, desde que
  inclua o dia atual da localidade. **Atualizar previsão** força uma consulta.
  Falhas de rede/API recuperam a última previsão salva, com data de atualização.
  Previsões vencidas exibem suas datas reais e aviso; sem cache, aparece
  **Clima indisponível**. O retorno da conexão também dispara uma atualização.
- **Chuva na fazenda** usa exclusivamente leituras reais do pluviômetro.
  **Registrar chuva** aceita zero e decimais com ponto ou vírgula, exige data
  válida e envia a leitura por `salvarRegistro('chuvas', registro)`.
- Os totais incluem hoje (data local do aparelho): últimos sete dias = hoje
  e seis dias anteriores; últimos 30 = hoje e 29 anteriores. Leituras do mesmo
  dia são somadas. Datas futuras ficam fora dos totais até chegar seu dia.
  Dias sem leitura não significam necessariamente ausência de chuva.

### Atualização necessária no Supabase

**Projeto existente com as quatro tabelas:** execute **todo o conteúdo** de
[`supabase/migrations/20260926_sync_bidirecional.sql`](supabase/migrations/20260926_sync_bidirecional.sql)
no SQL Editor, antes de atualizar os aparelhos. O arquivo adiciona
`atualizado_em`, preenche registros antigos a partir de `criado_em`, define
o padrão `now()` e cria a RPC `sincronizar_registro` com execução permitida
para os papéis `anon`/`authenticated`, mantendo suas permissões
de tabela. Rodar apenas os quatro `ALTER TABLE` não instala a RPC necessária.

**Projeto novo ou ainda sem a tabela `chuvas`:** execute
[`supabase/schema.sql`](supabase/schema.sql) inteiro, que inclui a mesma
migração e é reaplicável. Nenhuma tabela remota é necessária para cache,
localização ou fila. O app não executa SQL de migração automaticamente.

## Para rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Para conectar ao Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, rode o conteúdo de `supabase/schema.sql`.
3. Em Project Settings > API, copie a "Project URL" e a "anon public key".
4. Copie `.env.example` para `.env` e cole os dois valores.

Sem o `.env` preenchido, o app funciona só localmente (Dexie), sem
sincronizar com a nuvem — o que é suficiente para testar no seu
próprio celular antes de conectar tudo.

## Para publicar na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), "Add New > Project" e importe
   o repositório (a Vercel detecta o Vite sozinha).
3. Em Settings > Environment Variables, adicione as mesmas duas
   variáveis do `.env`.
4. Deploy.

## Validação

```bash
npm run build
node scripts/browser-smoke.mjs
```

O teste de navegador requer Node 22+ e Chromium/Edge instalado. Defina
`BROWSER_PATH` com o caminho do executável se não estiver no caminho padrão
do Edge no Windows. Usa perfil temporário, banco isolado e Supabase simulado:
verifica cadastro, persistência após recarga, pesagem, validação de venda,
histórico, fila offline, rollback e conversão dos campos enviados. A extensão
`scripts/weather-smoke.mjs` simula a Open-Meteo e verifica geocoding, cache,
falhas, retorno da conexão, localização diferente, previsão vencida, formulário
de chuva e limites dos acumulados. O teste também migra um banco v1 com dados
existentes para a v2 e verifica a preservação de registros e fila.

`scripts/sync-smoke.mjs`, executado pelo mesmo comando de navegador, testa
dois bancos Dexie independentes contra o transporte simulado de
`scripts/supabase-mock.js`: A cria lote e B recebe; B pesa e A recebe;
offline/reabertura; conflitos nos dois sentidos; falhas; chamadas simultâneas;
edição durante envio; empate; dados antigos; paginação acima de mil linhas;
e atualização reativa da Home ao disparar `online`.

O SQL também pode ser validado sem acessar Supabase, em um PostgreSQL/WASM
temporário. Instale `@electric-sql/pglite` numa pasta de teste **fora do projeto**,
defina `PGLITE_MODULE` com o caminho absoluto para seu `dist/index.js` e execute
`node scripts/sql-smoke.mjs`. Não é uma dependência do aplicativo. O teste
verifica migração preenchida/idempotente, RPC nas quatro tabelas, versões,
empates, nulos e execução sem elevação de permissões. A concorrência de rede
é exercitada no teste de navegador; o banco WASM usa uma única conexão.

## Próximos passos

- Conectar uma fonte real de cotação; a Home mostra sua indisponibilidade.
- Implementar exclusão/desfazer com suporte na fila de sincronização.
  Nesta etapa, o histórico é somente de consulta.
- Adicionar o manifesto de ícones do PWA (`public/icon-192.png` e
  `public/icon-512.png` — hoje são só referências no
  `vite.config.js`, ainda faltam os arquivos de imagem).
