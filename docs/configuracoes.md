# Configurações — 27/09/2026

## Acesso e organização

A engrenagem no topo da Home abre Configurações. Possui aria-label/title,
ícone Lucide Settings e área de 48 × 48 px. A navegação inferior continua com
Início, Lotes, Registrar e Histórico; Configurações pertence ao contexto de Início.
Há botão de voltar e foco no conteúdo principal ao navegar.

A nova tela reúne:

- Localização da propriedade: mesmo componente de GPS, busca, resumo e confirmação.
- Aparência: Sistema, Claro e Escuro, com seleção anunciada por aria-pressed.
- Cotação: UF efetiva, origem propriedade/comercial, ação de usar UF da propriedade
  e formulário existente para alterar UF comercial. Preço manual apenas em Mais
  opções, disponível quando offline ou quando a fonte falhou.
- Sincronização: mesmo estado centralizado, quantidade de operações pendentes e
  Sincronizar agora. Desabilitado enquanto sincroniza, offline ou sem nuvem configurada.
- Sobre o Rebanho: versão de package.json e explicação curta do uso offline.

Não é exibido status de instalação, pois não foi acrescentada detecção de PWA.
A versão identifica o pacote atual; o processo de lançamento continua responsável
por atualizá-la. Os problemas de ícones/PWA registrados na revisão anterior permanecem.

## O que saiu da Home

O bloco de localização, o formulário GPS inicial, as opções de UF comercial,
a opção de preço manual e o botão Sincronizar agora ficam em Configurações.
O clima continua exibindo o nome da localização, mas sem botão direto de alteração.
Sem configuração, clima/cotação encaminham para a nova tela.

Continuam na Home os dados de acompanhamento, previsão, preço, chuva, alertas,
categorias, lotes/pastos e ações operacionais. Atualizar previsão e Atualizar cotação
permanecem junto dos dados. O status de sincronização no topo é apenas informativo;
a tela de Configurações não repete esse cabeçalho, usando sua seção detalhada.

## Reutilização e atalhos mantidos

ThemeToggle permanece como atalho de troca rápida. Não há outra preferência:
alternarTema e o seletor chamam a mesma implementação de theme.js. A chave antiga
rebanho:tema é preservada; a escolha system volta a acompanhar prefers-color-scheme,
inclusive após recarga. localStorage continua exclusivo da aparência.

O status foi extraído de App.jsx para StatusSincronizacao.jsx, usando getSyncStatus,
subscribeSyncStatus e sincronizarTudo existentes. A contagem de pendências continua
vindo da leitura reativa do App. Não há estado de sincronização paralelo.

A configuração comercial observa cotacao.js e chama as funções existentes. Não
faz fetch ou mantém outro cache. A ação Usar UF da propriedade também continua no
formulário comercial existente, como saída contextual para cancelar uma exceção;
ambos os botões usam a mesma função centralizada.

Os formulários de localização e cotação agora voltam para Configurações. Ao salvar,
continuam retornando à Home para ver o resultado, preservando o comportamento
anterior. Nenhuma alteração em GPS, caches, APIs, modelo, regras ou persistência.

## Validação

- npm run build: passou. Maior chunk 226,68 kB; sem aviso de chunk acima de 500 kB.
- node scripts/browser-smoke.mjs: passou, incluindo todas as suítes anteriores e
  a nova settings-smoke (A–K).
- node scripts/pwa-smoke.mjs: passou, build de produção com rede externa bloqueada.
- node scripts/sql-smoke.mjs: passou com PostgreSQL/WASM local.
- git diff --check: passou.

Testes verificam entrada/volta, quatro abas, preferência manual prevalecendo sobre
sistema, opção Sistema persistente e reativa, localização sem GPS automático,
UF comercial/propriedade, disparo de sincronização pelo botão, offline, fallback
secundário fechado, controles de 44 px, temas claro/escuro e largura de 320 px.
Os testes antigos foram adaptados para acessar os controles pelo novo caminho;
não foram removidas validações de negócio. APIs e GPS permanecem simulados.

## Arquivos

Criados:
- src/pages/Configuracoes.jsx
- src/components/StatusSincronizacao.jsx
- scripts/settings-navigation.mjs
- scripts/settings-smoke.mjs
- docs/configuracoes.md

Modificados:
- src/App.jsx
- src/pages/Home.jsx
- src/pages/ConfigurarLocalizacao.jsx
- src/pages/ConfigurarCotacao.jsx
- src/components/BottomNav.jsx
- src/components/Clima.jsx
- src/components/CotacaoArroba.jsx
- src/lib/theme.js
- src/styles/app.css
- scripts/browser-smoke.mjs
- scripts/weather-smoke.mjs
- scripts/maintenance-smoke.mjs
- scripts/quote-smoke.mjs
- scripts/property-smoke.mjs
- docs/localizacao-propriedade.md
- docs/cotacao-arroba.md

Build regenera dist/. Sem dependência nova, migration, backend ou publicação remota.
