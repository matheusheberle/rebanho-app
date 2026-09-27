# Revisão geral — 27/09/2026

## Escopo e resultado

Revisão de código, fluxos em navegador Chromium descartável, SQL local e build de
produção. Não houve consulta/escrita no Supabase real, deploy ou alteração de modelo
de negócio. Não é uma auditoria de segurança completa nem certificação de acessibilidade.

## Corrigido agora

| Problema observado no código | Correção |
| --- | --- |
| Atualizar clima retirava a previsão da tela enquanto aguardava a rede | Exibe o cache assim que é lido e mantém a previsão durante a consulta |
| Clima não verificava atualização ao voltar à aba; evento online forçava rede mesmo com cache recente | Verificação em visibilitychange, usando TTL de uma hora; apenas o botão força atualização |
| Consulta de clima cancelada antes da leitura do cache ainda podia iniciar fetch | Verificação de cancelamento antes de iniciar a rede |
| Edição de lote sem trava síncrona e sem texto durante salvamento | Trava por ref e botão Salvando… |
| Exclusão podia tentar fechar um dialog já desmontado pela atualização reativa do Dexie | Fechamento tolerante à desmontagem, trava contra envio duplo e Escape bloqueado enquanto salva |
| Histórico podia manter filtro para lote que desapareceu por exclusão/sincronização | Retorna ao filtro Todos |
| Status não mostrava quantas operações ainda aguardavam envio | Contagem de pendências e linguagem mais direta para versões remotas; botão indisponível no estado Offline |
| Erro local de leitura da cotação podia continuar após recuperação | Limpa a mensagem quando nova tentativa termina sem erro local |
| Controles secundários pequenos e nomes longos potencialmente fora da largura | Mínimo de 44 px, quebra de texto e safe-area superior |
| Somente .env estava ignorado | Também ignora .env.*, mantendo .env.example versionável |
| Bundle único de aproximadamente 564 kB | Separação estática das dependências estáveis; nenhuma rota ou biblioteca nova |

## Cobertura dos fluxos

- Home: brinco principal, total vindo dos eventos, chips sem contagem por categoria,
  estados vazios, ações para primeiro lote, chuva, clima e cotação.
- Lotes/detalhe/novo/edição: categorias múltiplas e legadas, IDs preservados, nome do
  pasto histórico, peso/saldo, validações e gravações transacionais locais.
- Registrar/histórico: tipos existentes, saldo histórico, bloqueio de exclusão do
  evento inicial, exclusão/desfazer e histórico de pastos excluídos.
- Chuva: validação decimal, uma leitura ativa por data no fluxo local, RPC de
  concorrência, duplicidades preservadas e sinalizadas; totais parciais explicitamente
  não incluem datas duplicadas. Nenhuma previsão entra nesses totais.
- Pastos: normalização de nomes, duplicidade local, uso atual, exclusão bloqueada
  quando referenciado atualmente por lote ativo; sem cascade.
- Localização/clima: busca, coordenadas manuais, localização isolada da cotação,
  timezone, weather_code, cache por coordenada, falhas e recuperação.
- Cotação: mesmos endpoint/parser, cache de seis horas, isolamento por UF, HTTP 429,
  formato inválido, fallback manual, migração legada e retorno ao automático. Testes
  desta revisão usam mocks; não houve nova consulta à AgroDoc real.
- Tema/acessibilidade: preferência persistente, claro/escuro, foco visível, labels,
  chips com aria-pressed, status/erros anunciados, reduced-motion existente mantido.
  Não foi realizado teste com leitor de tela real ou todos os teclados móveis.
- Sincronização: gatilhos de início, online, focus, visibilitychange e ação manual;
  trava, fila, rollback, LWW, microsegundos, tombstones, alterações durante envio,
  restauração e paginação. Transporte simulado entre bancos independentes.

## Performance

Antes: JS principal 563,74 kB (gzip 165,90 kB).
Depois:

| Arquivo | Minificado | gzip |
| --- | ---: | ---: |
| App e ícones usados | 98,38 kB | 29,66 kB |
| Supabase | 226,68 kB | 58,83 kB |
| React/ReactDOM | 140,81 kB | 45,25 kB |
| Dexie | 96,57 kB | 32,44 kB |

Total aproximado: 562,44 kB / gzip 166,18 kB. Portanto, não há grande redução de
transferência inicial; o gzip total subiu cerca de 0,28 kB. O ganho é granularidade de
cache entre versões e fim do aviso de arquivo acima de 500 kB. As dependências são
carregadas no início e precacheadas pelo PWA. Lucide já usa imports nomeados; não foi
identificado import de todo o catálogo de ícones. Não foi acrescentado lazy loading
às páginas: exigiria tratamento adicional de falhas de chunks em navegação offline
para um ganho pequeno diante do tamanho atual do código do app.

## Recomendado para depois / riscos mantidos

1. **Acesso à nuvem:** sem autenticação/RLS e isolamento por propriedade, a chave
   pública não protege os dados. Mesmo com um único usuário, terceiros que conheçam
   o endpoint/chave podem acessar o que os grants permitem. Antes de múltiplos clientes,
   definir autenticação, propriedade dos dados, políticas RLS e permissões da RPC.
   Não ativado nesta revisão, conforme escopo. O estado remoto não foi inspecionado.
2. **Conflitos entre registros diferentes:** LWW resolve versões do mesmo ID, não
   invariantes do conjunto. Duas vendas offline em IDs distintos podem gerar saldo
   agregado negativo após sincronizar, embora cada aparelho tenha validado localmente.
   Criações de pastos em aparelhos diferentes podem repetir nome; exclusão e mudança
   simultâneas envolvendo IDs diferentes também precisam de política de reconciliação.
   Corrigir exige decisão de negócio/validação no servidor, não uma mudança pontual.
3. **Relógios diferentes:** timestamps dos aparelhos influenciam o vencedor. A
   monotonicidade atual é por registro, não corrige relógio errado entre aparelhos.
4. **Pendência inválida:** falha de um envio interrompe os seguintes naquele ciclo;
   o download ainda ocorre. Os dados permanecem locais, mas falta uma visualização
   por registro para resolver pendências que não se resolvem com nova tentativa.
5. **Escala:** app observa conjuntos inteiros e sincroniza todas as tabelas. Para
   grandes históricos, medir incremental/paginação e listas virtuais antes de mudar.
6. **Formulários:** navegar para outra tela ou fechar o app pode descartar texto ainda
   não salvo. Rascunhos/aviso de saída merecem fluxo próprio e testes; falha ao salvar
   já preserva os campos. Não acrescentado um bloqueio global de navegação.
7. **Resiliência:** prever tratamento global para dados remotos inválidos/erros de
   renderização e recuperação de armazenamento indisponível. Não resetar IndexedDB.
8. **Armazenamento:** exclusão dos dados do navegador remove dados locais, sobretudo
   pendentes. Falta estratégia de backup/exportação e verificação de persistência do
   armazenamento. Dados já sincronizados continuam recuperáveis pela nuvem.

## PWA / mobile

Já existem viewport-fit=cover, largura máxima de 480 px, quatro abas, safe-area
inferior, manifest e precache do HTML/JS/CSS. O teste de produção verificou abertura,
cadastro e recarga offline a 320 px.

Pendências concretas: `public/` está vazio, mas o manifest declara `icon-192.png` e
`icon-512.png`, e includeAssets declara `favicon.svg`. Preparar ícones reais, incluindo
maskable/apple-touch-icon se necessário, e validar instalação Android/iOS em aparelho
físico. Fontes do Google são externas: offline usa as fontes de sistema disponíveis.
Avaliar hospedar fontes localmente. Validar teclado virtual, acessibilidade com leitor
de tela e ciclo de atualização do service worker em dispositivo instalado.

A configuração atual usa autoUpdate; o registro gerado registra o worker diretamente.
Não se testou a troca entre duas versões publicadas. Antes de ampliar o fluxo de
atualização, garantir que ele não interrompa formulários; considerar atualização
avisada pelo usuário. Não foi trocada a estratégia de atualização nesta revisão.

## Segurança e logs verificados

`.env` não está versionado, está ignorado e não apareceu no histórico Git disponível.
Inspeção local sem imprimir valores identificou uma chave pública anon/publicável,
não service_role/secret. Isso não audita credenciais históricas externas ou a Vercel.
Nenhum console.log/console.error foi encontrado no código de produção em src.
A RPC usa lista permitida de tabelas/campos, parâmetros e SECURITY INVOKER; testes SQL
verificam ausência de elevação de privilégio. Não foi executado scanner de dependências.

Referências técnicas consultadas:
[segurança de chaves Supabase](https://supabase.com/docs/guides/getting-started/api-keys),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[build Vite](https://vite.dev/guide/build),
[atualização PWA](https://vite-pwa-org.netlify.app/guide/auto-update).

## Depende de validação com o cliente

- Escolher se a interface deve privilegiar “pasto” ou “potreiro”. Hoje o cadastro usa
  Pastos e potreiros e o manejo usa potreiro; não foi feita substituição arbitrária.
- Lista definitiva de categorias e eventual divisão de cabeças entre elas permanecem
  fora do escopo. A Home continua sem inventar quantidades.
- Qual decisão apresentar em vendas offline conflitantes, pastos de mesmo nome e
  conflitos entre manejo e exclusão em aparelhos distintos.
- Identidade dos ícones PWA e conveniência de rascunhos/aviso ao sair.

## Validação executada

- `npm run build`: passou, sem aviso de chunk acima de 500 kB.
- `node scripts/browser-smoke.mjs`: passou; inclui clima/chuva, sincronização,
  manutenção, categorias, pastos, cotação e novo review-smoke.
- `node scripts/sql-smoke.mjs`: passou com PGlite local (sem Supabase remoto).
- `node scripts/pwa-smoke.mjs`: passou usando dist, rede externa bloqueada, perfil
  temporário e armazenamento descartável; não toca os dados do produtor.
- `git diff --check`: passou.

O primeiro teste novo falhou ao tentar serializar um elemento DOM via protocolo do
navegador; a asserção foi corrigida para booleano e a suíte completa passou depois.
Não foi uma falha de dados ou do aplicativo.

Para reproduzir, definir BROWSER_PATH para Chromium/Edge e PGLITE_MODULE para a
instalação local do PGlite. O teste PWA exige build anterior. Nenhuma dependência nova.

## Arquivos

Modificados: `.gitignore`, `vite.config.js`, `src/App.jsx`,
`src/components/AcoesRegistro.jsx`, `src/components/Clima.jsx`,
`src/components/CotacaoArroba.jsx`, `src/lib/weather.js`,
`src/pages/EditarLote.jsx`, `src/pages/Historico.jsx`, `src/styles/app.css`,
`scripts/browser-smoke.mjs` e `docs/cotacao-arroba.md`.

Criados: `scripts/review-smoke.mjs`, `scripts/pwa-smoke.mjs` e este documento.
`dist/` regenerado. Sem migrations, alterações no calc.js, banco, arquitetura de
sincronização, autenticação ou regras de manejo.
