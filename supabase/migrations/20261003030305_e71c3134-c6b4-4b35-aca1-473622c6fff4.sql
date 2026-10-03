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

  perform set_config('app.solicitacao_decision','1',true);
  insert into public.solicitacao_decisoes(solicitacao_id,decidido_por,decisao,comentario)
  values(_solicitacao_id,auth.uid(),_decisao,nullif(trim(_comentario),'')) returning * into d;
  update public.solicitacoes set status=_decisao,decided_at=now(),updated_at=now() where id=_solicitacao_id;
  return d;
end;
$$;

create or replace function public.guard_solicitacao_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status <> new.status then
    if old.status = 'pendente' and new.status = 'cancelada' and old.created_by = auth.uid() then
      new.updated_at=now(); return new;
    end if;
    if current_setting('app.solicitacao_decision',true) <> '1' then
      raise exception 'Mudanças de decisão só podem ocorrer pela função de decisão.';
    end if;
  end if;

  if old.status='pendente' and new.created_by=auth.uid() then
    if new.tipo is distinct from old.tipo or new.titulo is distinct from old.titulo or new.detalhes is distinct from old.detalhes or new.status <> 'pendente' then
      raise exception 'O autor só pode anexar arquivos ou cancelar enquanto pendente.';
    end if;
    new.updated_at=now(); return new;
  end if;

  if public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin') then
    if new.created_by is distinct from old.created_by or new.tipo is distinct from old.tipo or new.titulo is distinct from old.titulo or new.detalhes is distinct from old.detalhes or new.attachment_paths is distinct from old.attachment_paths then
      raise exception 'Direção/admin não pode alterar o conteúdo da solicitação.';
    end if;
    new.updated_at=now(); return new;
  end if;

  raise exception 'Alteração não permitida.';
end;
$$;