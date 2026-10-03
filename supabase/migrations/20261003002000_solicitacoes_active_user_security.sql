alter table public.solicitacoes enable row level security;
alter table public.solicitacao_decisoes enable row level security;

drop policy if exists "Acesso somente pessoa ativa" on public.solicitacoes;
create policy "Acesso somente pessoa ativa" on public.solicitacoes as restrictive
for all to authenticated using (public.is_active_authorized_user(auth.uid()))
with check (public.is_active_authorized_user(auth.uid()));

drop policy if exists "Acesso somente pessoa ativa" on public.solicitacao_decisoes;
create policy "Acesso somente pessoa ativa" on public.solicitacao_decisoes as restrictive
for all to authenticated using (public.is_active_authorized_user(auth.uid()))
with check (public.is_active_authorized_user(auth.uid()));

create or replace function public.decidir_solicitacao(
  _solicitacao_id uuid,
  _decisao public.request_status,
  _comentario text default null
)
returns public.solicitacao_decisoes
language plpgsql
security definer
set search_path = public
as $$
declare s public.solicitacoes; d public.solicitacao_decisoes;
begin
  if not public.is_active_authorized_user(auth.uid()) then raise exception 'Usuário inativo ou não autorizado.'; end if;
  if not (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin')) then raise exception 'Somente direção ou admin pode decidir solicitações.'; end if;
  if _decisao not in ('aprovada','negada') then raise exception 'Decisão inválida.'; end if;
  if _decisao='negada' and nullif(trim(coalesce(_comentario,'')),'') is null then raise exception 'Negar uma solicitação exige justificativa.'; end if;
  select * into s from public.solicitacoes where id=_solicitacao_id for update;
  if s.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if s.status<>'pendente' then raise exception 'Esta solicitação já foi decidida ou cancelada.'; end if;
  insert into public.solicitacao_decisoes(solicitacao_id,decidido_por,decisao,comentario)
  values(_solicitacao_id,auth.uid(),_decisao,nullif(trim(_comentario),'')) returning * into d;
  update public.solicitacoes set status=_decisao,decided_at=now(),updated_at=now() where id=_solicitacao_id;
  return d;
end;
$$;
