-- Executar inteiro manualmente, após 20260926_soft_delete_edicao.sql.
-- Preserva a coluna antiga durante a transição; não muda timestamps.
begin;
alter table public.lotes add column if not exists categorias text[];
update public.lotes
set categorias = case when nullif(btrim(categoria), '') is not null then array[btrim(categoria)] else array[]::text[] end
where categorias is null;
create or replace function public.sincronizar_registro(p_tabela text, p_registro jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  campos text[];
  colunas text;
  atribuicoes text;
  resultado jsonb;
begin
  case p_tabela
    when 'pastos' then campos := array['id', 'nome', 'criado_em', 'atualizado_em', 'excluido_em'];
    when 'lotes' then campos := array['id', 'nome', 'categoria', 'categorias', 'criado_em', 'atualizado_em', 'excluido_em'];
    when 'eventos' then campos := array['id', 'lote_id', 'tipo', 'data', 'qtd', 'peso', 'produto', 'carencia', 'pasto_id', 'fim', 'obs', 'criado_em', 'atualizado_em', 'excluido_em'];
    when 'chuvas' then campos := array['id', 'data', 'mm', 'obs', 'criado_em', 'atualizado_em', 'excluido_em'];
    else raise exception 'Tabela não sincronizável: %', p_tabela;
  end case;

  if p_registro->>'id' is null or p_registro->>'atualizado_em' is null then
    raise exception 'id e atualizado_em são obrigatórios';
  end if;

  -- Clientes legados podem mudar nome/exclusão, mas não reduzir categorias.
  if p_tabela = 'lotes' then
    perform pg_catalog.pg_advisory_xact_lock(726226, 2);
    if p_registro->'categorias' is null or p_registro->'categorias' = 'null'::jsonb then
      select to_jsonb(r.*) into resultado from public.lotes r where r.id = (p_registro->>'id')::uuid;
      p_registro := p_registro || jsonb_build_object('categorias',
        coalesce(nullif(resultado->'categorias', 'null'::jsonb),
          case when nullif(btrim(coalesce(p_registro->>'categoria', resultado->>'categoria')), '') is not null
          then jsonb_build_array(btrim(coalesce(p_registro->>'categoria', resultado->>'categoria'))) else '[]'::jsonb end));
    end if;
    if jsonb_typeof(p_registro->'categorias') <> 'array' then
      raise exception 'categorias deve ser uma lista';
    end if;
    if (jsonb_array_length(p_registro->'categorias') = 0 and p_registro->>'excluido_em' is null)
      or exists (select 1 from jsonb_array_elements(p_registro->'categorias') c
        where jsonb_typeof(c) <> 'string' or btrim(c #>> '{}') = '') then
      raise exception 'Selecione pelo menos uma categoria válida';
    end if;
    p_registro := p_registro || jsonb_build_object('categoria', coalesce(p_registro->'categorias'->>0, p_registro->>'categoria', ''));
    resultado := null;
  end if;
  -- Serializa escritas de chuva feitas pela RPC, inclusive UUIDs diferentes.
  -- Duplicidades legadas são preservadas para correção explícita no aplicativo.
  -- Não cria índice UNIQUE que impediria a migração de bancos já duplicados.
  if p_tabela = 'chuvas' then
    perform pg_catalog.pg_advisory_xact_lock(726226, 1);
    select to_jsonb(r.*) into resultado from public.chuvas r
      where r.id = (p_registro->>'id')::uuid;
    if resultado is not null and (p_registro->>'atualizado_em')::timestamptz <=
      coalesce((resultado->>'atualizado_em')::timestamptz, (resultado->>'criado_em')::timestamptz, '1970-01-01'::timestamptz) then
      return resultado;
    end if;
    if p_registro->>'excluido_em' is null and exists (
      select 1 from public.chuvas r where r.data = (p_registro->>'data')::date
        and r.id <> (p_registro->>'id')::uuid and r.excluido_em is null
    ) then
      raise exception 'Já existe uma leitura ativa nesta data. Confira as leituras de chuva no aplicativo.';
    end if;
  end if;

  select string_agg(format('%I', campo), ', '),
    string_agg(case when campo = 'excluido_em'
      then 'excluido_em = case when $1 ? ''excluido_em'' then excluded.excluido_em else atual.excluido_em end'
      else format('%1$I = excluded.%1$I', campo) end, ', ')
      filter (where campo not in ('id', 'criado_em'))
  into colunas, atribuicoes from unnest(campos) as c(campo);

  -- Tabela e campos vêm exclusivamente da lista acima; o payload é parâmetro.
  execute format(
    'insert into public.%1$I as atual (%2$s)
     select %2$s from jsonb_populate_record(null::public.%1$I, $1) where true
     on conflict (id) do update set %3$s,
       criado_em = coalesce(atual.criado_em, excluded.criado_em)
     where excluded.atualizado_em > coalesce(atual.atualizado_em, atual.criado_em, ''1970-01-01T00:00:00Z''::timestamptz)
     returning to_jsonb(atual.*)', p_tabela, colunas, atribuicoes)
  into resultado using p_registro;

  if resultado is null then
    -- ON CONFLICT também bloqueia a linha quando o WHERE rejeita a edição.
    execute format('select to_jsonb(r.*) from public.%I r where id = $1', p_tabela)
      into resultado using (p_registro->>'id')::uuid;
  end if;
  if resultado is null then raise exception 'Registro não disponível para confirmação'; end if;
  return resultado;
end;
$$;

revoke all on function public.sincronizar_registro(text, jsonb) from public;
grant execute on function public.sincronizar_registro(text, jsonb) to anon, authenticated;
commit;
