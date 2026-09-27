# Cotação automática da arroba

## Fonte e contrato verificado

Endpoint JSON: `GET https://agrodocai.com.br/api/v1/cotacao?uf=PR`.
Consulta real validada em 26/09/2026, com HTTP 200 e CORS `*`, sem autenticação.
A resposta recebida foi agregada, incluindo:

```json
{
  "boi_gordo_cepea_sp": 358.8,
  "boi_gordo_uf": { "uf": "PR", "preco": 367.0, "praca": "PR" },
  "atualizado": "2026-09-26T18:06:12-04:00",
  "fonte": "CEPEA/ESALQ · NoticiasAgricolas · Scot Consultoria",
  "license": "CC-BY-4.0 · atribuicao AgroDoc AI",
  "rate_limit": { "diario": 100, "restante": 99 }
}
```

O parser usa exclusivamente `boi_gordo_uf.preco`, conferindo a UF solicitada.
Não substitui uma região sem dados pelo indicador de São Paulo.
Também aceita o formato plano documentado: `produto: "boi_gordo"`, `uf`,
`valor`, `moeda: "BRL"`, `unidade: "@"`, `fonte` e `data_cotacao`.
Valida preço positivo, produto/unidade quando explícitos, fonte, UF e data.
Se houver somente `atualizado`, a Home identifica a data como atualização da fonte,
e não como data comprovada da negociação. O horário da consulta local fica separado.
Não há cálculo de variação: os formatos verificados não garantem percentual regional comparável.

Referências: [documentação geral](https://agrodocai.com.br/api-docs) e
[documentação para desenvolvedores PR](https://agrodocai.com.br/api/cotacao-pr-dev).
As páginas divergem sobre limites: a documentação regional e a resposta real indicam
100 requisições/dia/IP. O app adota esse limite mais restritivo como referência.
A atribuição **Cotação via AgroDoc AI · agrodocai.com.br** permanece visível.
Não foi implementado scraping; a integração consulta apenas JSON estruturado.

## Uso

Abra **Configurações** pela engrenagem da Home e configure a **Localização da propriedade**. Sua UF será usada como referência. O aplicativo consulta
automaticamente a fonte. A configuração principal não pede preço, fonte ou data.
A referência comercial padrão é a UF da propriedade. É possível escolher outra UF em uma opção secundária; veja [Localização da propriedade](localizacao-propriedade.md).
**Configurações → Cotação da arroba → Alterar UF comercial** permite uma exceção comercial; cada estado mantém seu próprio cache.
**Atualizar** solicita nova consulta, respeitando os intervalos de proteção.

## Cache, rede e limites

O módulo `src/lib/cotacao.js` centraliza consulta, parser, preferências e cache.
Usa a tabela Dexie `configuracoes` existente:

- `cotacao:preferencia`: origem propriedade, ou exceção manual com UF e nome do estado;
- `cotacao:automatico:<UF>`: última resposta normalizada e horário da consulta;
- `cotacao:manual:<UF>`: último valor manual, separado do automático;
- `cotacao:estado:<UF>`: modo, última tentativa e erros temporários;
- `cotacao:agrodoc:limites`: controle local de chamadas.

A Home lê o cache imediatamente por `liveQuery`. O cache automático vale seis horas.
Há verificação ao abrir a seção, trocar a UF, recuperar a conexão e voltar à aba.
Não há polling nem chamada a cada render. Consultas simultâneas são agrupadas;
Web Locks também serializa chamadas entre abas quando disponível.

Cada consulta tem timeout de nove segundos. Há intervalo mínimo de um minuto entre
consultas da mesma UF, espera de quinze minutos após falhas e respeito ao `Retry-After`
no HTTP 429 (se ausente, seis horas). A pausa por 429 vale para todas as UFs.
O botão Atualizar não ignora esses limites. O app limita chamadas a 80 por dia UTC
neste aparelho; outros aparelhos no mesmo IP ainda podem consumir a quota da API.

Offline ou com erro, o último valor é preservado e identificado como última cotação
disponível. Sem cache, aparece **Cotação indisponível no momento**. HTTP 4xx/5xx,
429, JSON inválido, formato inesperado, região ausente e timeout não substituem preço por zero.

## Fallback manual e compatibilidade

Somente offline ou após falha da fonte aparece **Configurações → Cotação da arroba → Mais opções → Informar valor manualmente**.
O formulário secundário permite preço positivo com ponto/vírgula e data válida
(preenchida com hoje). Fonte e variação não são solicitadas. A Home mostra
**Valor informado manualmente**. Uma consulta automática bem-sucedida volta a exibir
o preço automático; o cache manual permanece preservado.

Preferências antigas de praça são migradas para a UF correspondente. O último preço
manual antigo permanece manual e conserva a identificação da região anterior.
As chaves antigas não são apagadas. Não há alteração do schema ou versão Dexie,
SQL, Supabase ou fila de sincronização. Preferências e cache ficam neste aparelho.

## Validação

- `npm run build`.
- `node scripts/browser-smoke.mjs` com `BROWSER_PATH`: suíte existente e testes de cotação
  com API simulada, incluindo configuração, persistência, TTL, offline, falhas, HTTP 429,
  JSON/formato inválido, região ausente, timeout, fallback, recuperação automática,
  migração legada, concorrência, temas claro/escuro e largura de 320 px.
- `node scripts/sql-smoke.mjs` com `PGLITE_MODULE`: regressão SQL em PostgreSQL/WASM local.
- Opcional: `node scripts/quote-live-smoke.mjs PR`, uma chamada real à API e validação
  pelo mesmo parser. Foi executado com sucesso; não é dependência da suíte normal.

## Limitações

A disponibilidade e frequência de atualização dependem da AgroDoc e suas fontes.
A documentação regional informa cobertura de 18 UFs; a lista permite escolher os
27 estados/DF, mas ausência de cotação resulta em cache/fallback, nunca preço nacional.
Não há garantia de mesma condição comercial entre fontes agregadas, série histórica
ou cotação intradiária. Não se calcula valor financeiro do rebanho.
Limpar os dados do navegador remove as preferências/cache locais.
Nenhuma biblioteca foi adicionada, nenhuma migration é necessária e não houve publicação remota.
O aviso de bundle observado nesta etapa foi resolvido na revisão de 27/09/2026; veja revisao-geral-20260927.md para as métricas e limitações.

## Arquivos desta etapa

Modificados: `src/lib/cotacao.js`, `src/components/CotacaoArroba.jsx`,
`src/pages/ConfigurarCotacao.jsx`, `src/styles/app.css`, `scripts/quote-smoke.mjs`
e este documento. Criado: `scripts/quote-live-smoke.mjs`. O build regenera `dist/`.
