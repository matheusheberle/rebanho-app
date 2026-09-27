# Localização da propriedade — 27/09/2026

## Fluxo

A tela Configurações, acessada pela engrenagem da Home, contém a área Localização da propriedade. Veja [Configurações](configuracoes.md). No primeiro uso, o produtor
pode usar a posição atual do aparelho ou pesquisar uma cidade/localidade. Ambos
os caminhos levam à confirmação da mesma configuração antes de salvar.

Use minha localização somente enquanto estiver na propriedade. O app chama
`navigator.geolocation.getCurrentPosition` uma vez por toque; não há watchPosition,
consulta na inicialização, fallback por IP ou rastreamento em segundo plano.
Configuração: maximumAge 0, timeout de 10 segundos, sem exigir alta precisão.
Uma proteção adicional encerra a espera em 11 segundos se o navegador não responder.
Permissão negada, timeout e indisponibilidade têm mensagens próprias e alternativa manual.
Sair do fluxo ignora resultados atrasados e cancela a consulta HTTP quando possível.

Após o GPS, município/UF são consultados uma única vez. O resultado preenche a tela
para confirmação, sem substituir a propriedade salva até tocar em Salvar localização.
Se a identificação falhar, as coordenadas obtidas continuam no formulário e o usuário
pode confirmar município e UF manualmente. Também é possível salvar só as coordenadas
para o clima e completar a UF depois. A edição de coordenadas fica em uma opção
secundária, não é necessária no fluxo normal; alterá-las limpa município/UF do rascunho.

A busca manual existente usa Open-Meteo Geocoding. O resultado traz coordenadas,
localidade/município e UF quando o país é BR e o admin1 corresponde a um estado
brasileiro. Não se deduz UF a partir de coordenadas ou de um nome ambíguo.

## Fonte de município/UF e privacidade

Para GPS: GET `https://api.bigdatacloud.net/data/reverse-geocode-client`
com latitude, longitude e localityLanguage=pt. Timeout de oito segundos.
Usa countryCode, principalSubdivisionCode/principalSubdivision e city/locality;
valida que a resposta corresponde às coordenadas e é baseada nelas, não em IP.
Os identificadores documentados coordinates e reverseGeocoding são aceitos.

O endpoint público é gratuito, sem chave, para consulta direta pelo dispositivo
com sua posição atual consentida. Por isso não é usado para consultar coordenadas
antigas, digitadas, buscas manuais ou no servidor. A documentação foi verificada;
nenhuma posição real do usuário foi coletada para testes. Os testes usam mocks.

A interface informa antes do botão que as coordenadas serão enviadas à BigDataCloud
para identificar o local. O provedor informa uso de sinais anônimos de GPS/IP para
melhorar sua base. Isso é processamento do provedor; o Rebanho não adiciona tracking.
As coordenadas salvas também são enviadas à Open-Meteo quando se consulta a previsão.
A AgroDoc recebe apenas a UF, não as coordenadas. Nenhum desses dados entra no Supabase.

Referências:
- [BigDataCloud — endpoint e campos](https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocode-to-city-api)
- [Condições do serviço gratuito](https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free)
- [SDK oficial — formato coordinates](https://github.com/bigdatacloudapi/react-reverse-geocode-client)
- [Open-Meteo — geocoding](https://open-meteo.com/en/docs/geocoding-api)

## Fonte única, compatibilidade e armazenamento

`src/lib/propriedade.js` centraliza leitura, normalização, validação, gravação e GPS.
A localização continua na tabela Dexie configuracoes, chave `localizacao`:

```js
{
  chave: 'localizacao',
  nome: 'Cascavel - PR',
  municipio: 'Cascavel',
  uf: 'PR',
  latitude: -24.95,
  longitude: -53.45,
  atualizadoEm: '...'
}
```

Não foi criada uma segunda configuração da propriedade. Dados antigos continuam
funcionando com as mesmas coordenadas e nome. A normalização na leitura acrescenta
campos ausentes; rótulos antigos no formato cidade, estado, Brasil/Brazil permitem
reaproveitar município/UF sem rede. Nomes ambíguos mantêm UF desconhecida, sem pedir
nova localização. Ao salvar novamente, a estrutura completa é persistida. Nenhuma
migração de versão Dexie ou SQL é necessária, nem reset/remoção de dados antigos.

A lista de estados foi extraída da cotação para estados.js; cotacao.js mantém a
reexportação por compatibilidade. weather.js mantém salvarLocalizacao como alias
para a gravação centralizada. Nenhuma regra de rebanho foi alterada.

## Clima e cotação

O clima usa exclusivamente latitude/longitude da propriedade salva. Os caches de
previsão são separados por coordenada. Uma mudança de posição remove o cache do
destino antes de gravar a nova configuração, exigindo atualização mesmo ao voltar a
uma posição antiga. Caches de outras coordenadas ficam preservados, mas não são
selecionados. Offline, uma posição nova pode ficar sem previsão até recuperar a rede;
nunca recebe a previsão de outra propriedade. Mudança apenas de nome/UF preserva a
previsão da mesma coordenada. As gravações de configuração/cache são transacionais.

A referência padrão da arroba é resolvida diretamente da UF da propriedade, sem
copiá-la para outro registro. Preferências comerciais antigas são reaproveitadas
quando a localização legada ainda não permite identificar UF.

A opção Configurações → Cotação da arroba → Alterar UF comercial permite
uma exceção comercial explícita. A Home identifica que a UF foi escolhida separadamente.
Na configuração existe Usar UF da propriedade. Salvar uma nova configuração da
propriedade também restaura esse padrão — informado no formulário da exceção.
Se a nova propriedade não tiver UF, não se reutiliza silenciosamente a UF anterior.

O registro cotacao:preferencia guarda origem: propriedade (sem copiar UF) ou a
exceção manual. Caches de cotação continuam separados por UF, com TTL de seis horas,
controle de concorrência e HTTP 429 existentes. O fallback de preço manual permanece
em Configurações → Cotação da arroba → Mais opções quando a fonte está indisponível/offline; a gravação confere a UF
efetiva para não salvar um valor numa região que mudou durante o formulário.

## Validação

- npm run build: passou; maior chunk 226,68 kB, sem aviso acima de 500 kB.
- node scripts/browser-smoke.mjs: todas as suítes anteriores e property-smoke passaram.
- node scripts/pwa-smoke.mjs: passou com build real e rede externa bloqueada.
- node scripts/sql-smoke.mjs: passou em PGlite local, sem acesso ao Supabase.

Os testes novos cobrem primeiro uso, GPS só por ação, confirmação, recarga sem GPS,
permissão negada, timeout, indisponibilidade, busca manual, UF automática, troca de
coordenadas/UF, caches distintos, offline, exceção comercial/retorno ao padrão,
resposta por IP rejeitada, JSON inválido, exterior, dados legados, cancelamento,
320 px e temas claro/escuro. A fila de sincronização não se altera.

## Limitações

- GPS requer permissão e contexto seguro (HTTPS ou localhost); a precisão depende
  do aparelho/navegador e não é garantidamente a posição exata da sede da fazenda.
- Busca manual usa coordenadas da localidade, não identifica limites da propriedade.
- Município/UF podem não ser encontrados; confirmação manual permanece disponível.
- Serviços externos precisam de conexão e estão sujeitos às próprias condições e
  disponibilidade. Não há SLA contratado ou requisições reais de GPS neste teste.
- Configuração fica neste aparelho e não é sincronizada com outros navegadores.
- Nenhum mapa, geofencing, GPS por pasto/evento, autenticação ou módulo novo foi criado.

## Arquivos desta etapa

Criados: src/lib/propriedade.js, src/lib/estados.js,
src/components/LocalizacaoPropriedade.jsx, scripts/property-smoke.mjs e este documento.

Modificados: src/App.jsx, src/lib/weather.js, src/lib/cotacao.js,
src/pages/Home.jsx, src/pages/ConfigurarLocalizacao.jsx, src/pages/ConfigurarCotacao.jsx,
src/components/Clima.jsx, src/components/CotacaoArroba.jsx, src/styles/app.css,
scripts/browser-smoke.mjs, scripts/weather-smoke.mjs, scripts/quote-smoke.mjs,
docs/cotacao-arroba.md. dist/ regenerado.

Nenhuma dependência, migration ou mudança remota no Supabase. Nenhuma publicação.
