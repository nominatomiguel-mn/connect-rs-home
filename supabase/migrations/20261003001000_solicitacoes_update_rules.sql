create or replace function public.guard_solicitacao_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status <> 'pendente' and new.status <> old.status then
    raise exception 'Solicitação já encerrada.';
  end if;

  if old.status = 'pendente' and new.created_by = auth.uid() then
    if new.tipo is distinct from old.tipo or new.titulo is distinct from old.titulo or new.detalhes is distinct from old.detalhes or new.status not in ('pendente','cancelada') then
      raise exception 'O autor só pode anexar arquivos ou cancelar enquanto pendente.';
    end if;
    if cardinality(new.attachment_paths) > 3 then raise exception 'Máximo de 3 anexos.'; end if;
    new.updated_at = now();
    return new;
  end if;

  if public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin') then
    if new.created_by is distinct from old.created_by or new.tipo is distinct from old.tipo or new.titulo is distinct from old.titulo or new.detalhes is distinct from old.detalhes or new.attachment_paths is distinct from old.attachment_paths then
      raise exception 'Direção/admin não pode alterar o conteúdo da solicitação.';
    end if;
    new.updated_at = now();
    return new;
  end if;

  raise exception 'Alteração não permitida.';
end;
$$;
