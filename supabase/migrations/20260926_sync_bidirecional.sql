-- Execute este arquivo INTEIRO no SQL Editor, manualmente, antes de atualizar
-- os aparelhos. Não altera autenticação, RLS nem permissões das tabelas.
begin;

-- O preenchimento histórico usa a criação, não o horário da migração: evita
-- fazer um registro remoto antigo vencer uma edição offline mais recente.
alter table public.pastos add column if not exists atualizado_em timestamptz;
alter table public.lotes add column if not exists atualizado_em timestamptz;
alter table public.eventos add column if not exists atualizado_em timestamptz;
alter table public.chuvas add column if not exists atualizado_em timestamptz;

update public.pastos set atualizado_em = coalesce(criado_em, '1970-01-01T00:00:00Z'::timestamptz) where atualizado_em is null;
update public.lotes set atualizado_em = coalesce(criado_em, '1970-01-01T00:00:00Z'::timestamptz) where atualizado_em is null;
update public.eventos set atualizado_em = coalesce(criado_em, '1970-01-01T00:00:00Z'::timestamptz) where atualizado_em is null;
update public.chuvas set atualizado_em = coalesce(criado_em, '1970-01-01T00:00:00Z'::timestamptz) where atualizado_em is null;

alter table public.pastos alter column atualizado_em set default now();
alter table public.lotes alter column atualizado_em set default now();
alter table public.eventos alter column atualizado_em set default now();
alter table public.chuvas alter column atualizado_em set default now();

-- A comparação acontece sob o bloqueio da própria linha no PostgreSQL.
-- Em empate, mantém a versão já confirmada na nuvem (primeiro envio vence).
-- SECURITY INVOKER: usa as permissões/RLS do chamador, sem elevar privilégios.
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
    when 'pastos' then campos := array['id', 'nome', 'criado_em', 'atualizado_em'];
    when 'lotes' then campos := array['id', 'nome', 'categoria', 'criado_em', 'atualizado_em'];
    when 'eventos' then campos := array['id', 'lote_id', 'tipo', 'data', 'qtd', 'peso', 'produto', 'carencia', 'pasto_id', 'fim', 'obs', 'criado_em', 'atualizado_em'];
    when 'chuvas' then campos := array['id', 'data', 'mm', 'obs', 'criado_em', 'atualizado_em'];
    else raise exception 'Tabela não sincronizável: %', p_tabela;
  end case;

  if p_registro->>'id' is null or p_registro->>'atualizado_em' is null then
    raise exception 'id e atualizado_em são obrigatórios';
  end if;

  select string_agg(format('%I', campo), ', '),
    string_agg(format('%1$I = excluded.%1$I', campo), ', ')
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
