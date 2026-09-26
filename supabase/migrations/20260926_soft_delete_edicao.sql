-- Execute o arquivo inteiro manualmente. Requer a migration de sincronização bidirecional.
begin;
alter table public.pastos add column if not exists excluido_em timestamptz;
alter table public.lotes add column if not exists excluido_em timestamptz;
alter table public.eventos add column if not exists excluido_em timestamptz;
alter table public.chuvas add column if not exists excluido_em timestamptz;

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
    when 'lotes' then campos := array['id', 'nome', 'categoria', 'criado_em', 'atualizado_em', 'excluido_em'];
    when 'eventos' then campos := array['id', 'lote_id', 'tipo', 'data', 'qtd', 'peso', 'produto', 'carencia', 'pasto_id', 'fim', 'obs', 'criado_em', 'atualizado_em', 'excluido_em'];
    when 'chuvas' then campos := array['id', 'data', 'mm', 'obs', 'criado_em', 'atualizado_em', 'excluido_em'];
    else raise exception 'Tabela não sincronizável: %', p_tabela;
  end case;

  if p_registro->>'id' is null or p_registro->>'atualizado_em' is null then
    raise exception 'id e atualizado_em são obrigatórios';
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
