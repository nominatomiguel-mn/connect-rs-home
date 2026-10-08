ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS pedagogico boolean NOT NULL DEFAULT false;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS descricao text;

UPDATE public.sectors SET pedagogico = true WHERE name IN ('Papelaria','Materiais diversos para aulas','Xerox','Sala de leitura');
UPDATE public.sectors SET descricao = CASE name
  WHEN 'Limpeza' THEN 'Banheiros, salas sujas, lixo'
  WHEN 'Manutenção' THEN 'Ar-condicionado, lâmpada, vazamento, móveis quebrados'
  WHEN 'Papelaria' THEN 'Papel sulfite, canetas, cartolina'
  WHEN 'Materiais diversos para aulas' THEN 'Tesoura, cola, tinta, materiais para atividades'
  WHEN 'Xerox' THEN 'Cópias e impressões'
  WHEN 'Sala Interativa' THEN 'Projetor, lousa digital, computadores'
  WHEN 'Sala de leitura' THEN 'Livros, empréstimos, organização da sala'
  WHEN 'Teatro' THEN 'Som, palco, iluminação'
  WHEN 'Parque' THEN 'Brinquedos, areia, áreas externas'
  WHEN 'Quadra' THEN 'Bolas, redes, materiais esportivos'
  WHEN 'Laboratório de ciências' THEN 'Vidrarias, reagentes, equipamentos'
  WHEN 'Cozinha da nutrição' THEN 'Utensílios, equipamentos da cozinha'
  ELSE descricao END
WHERE descricao IS NULL;

CREATE OR REPLACE FUNCTION public.can_view_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.tickets t join public.sectors s on s.id = t.sector_id
    where t.id = _ticket_id and (
      public.has_role(_user_id, 'admin')
      or t.created_by = _user_id
      or exists (select 1 from public.sector_responsibles sr where sr.user_id = _user_id and sr.sector_id = t.sector_id)
      or (s.pedagogico and public.has_role(_user_id, 'direcao'))
    )
  )
$$;

DROP POLICY IF EXISTS "Ver chamados" ON public.tickets;
CREATE POLICY "Ver chamados" ON public.tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sector_responsibles sr WHERE sr.user_id = auth.uid() AND sr.sector_id = tickets.sector_id)
  OR (has_role(auth.uid(), 'direcao') AND EXISTS (SELECT 1 FROM public.sectors s WHERE s.id = tickets.sector_id AND s.pedagogico))
);

-- Fotos: ninguém apaga (nada é apagado, só arquivado)
DROP POLICY IF EXISTS "Excluir fotos do proprio chamado" ON storage.objects;

CREATE OR REPLACE FUNCTION public.guard_ticket_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
declare
  caller uuid := auth.uid();
  is_admin boolean;
  is_resp boolean;
  transferring boolean := coalesce(current_setting('app.transfer', true), '') = 'on';
begin
  if caller is null then raise exception 'Não autenticado.'; end if;
  select exists (select 1 from public.user_roles where user_id = caller and role = 'admin') into is_admin;
  if is_admin then return new; end if;

  if new.created_by is distinct from old.created_by
     or (new.sector_id is distinct from old.sector_id and not transferring)
     or new.priority is distinct from old.priority
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.location is distinct from old.location then
    raise exception 'Apenas o admin pode alterar os dados do chamado.';
  end if;

  select exists (select 1 from public.sector_responsibles where user_id = caller and sector_id = old.sector_id) into is_resp;
  if not is_resp then
    if new.status is distinct from old.status
       or new.solution_comment is distinct from old.solution_comment
       or new.solution_photo is distinct from old.solution_photo
       or new.resolved_at is distinct from old.resolved_at
       or new.sector_id is distinct from old.sector_id then
      raise exception 'Somente o responsável do setor pode alterar o chamado.';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.transferir_chamado(_ticket_id uuid, _novo_setor uuid, _motivo text)
RETURNS public.tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  caller uuid := auth.uid();
  t public.tickets;
  old_name text; new_name text;
begin
  if caller is null then raise exception 'Não autenticado.'; end if;
  if coalesce(length(trim(_motivo)), 0) < 3 then raise exception 'Informe o motivo da transferência.'; end if;
  select * into t from public.tickets where id = _ticket_id for update;
  if not found then raise exception 'Chamado não encontrado.'; end if;
  if t.status <> 'aberto' then raise exception 'Só é possível transferir chamados abertos.'; end if;
  if t.sector_id = _novo_setor then raise exception 'Escolha um setor diferente.'; end if;
  if not (public.has_role(caller, 'admin') or exists (
    select 1 from public.sector_responsibles where user_id = caller and sector_id = t.sector_id)) then
    raise exception 'Somente o responsável do setor pode transferir o chamado.';
  end if;
  select name into new_name from public.sectors where id = _novo_setor and active;
  if new_name is null then raise exception 'Setor de destino inválido.'; end if;
  select name into old_name from public.sectors where id = t.sector_id;

  perform set_config('app.transfer', 'on', true);
  update public.tickets set sector_id = _novo_setor where id = _ticket_id returning * into t;
  perform set_config('app.transfer', 'off', true);

  insert into public.ticket_history (ticket_id, actor_id, event, details)
  values (_ticket_id, caller, 'transferido', jsonb_build_object(
    'de_setor', old_name, 'para_setor', new_name, 'motivo', trim(_motivo)));
  return t;
end $$;

REVOKE ALL ON FUNCTION public.transferir_chamado(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_chamado(uuid, uuid, text) TO authenticated;

-- Lista pública de setores sem responsável (só nomes/ids; usada no aviso ao abrir chamado)
CREATE OR REPLACE FUNCTION public.setores_sem_responsavel()
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select s.id, s.name from public.sectors s
  where s.active and not exists (select 1 from public.sector_responsibles sr where sr.sector_id = s.id)
  order by s.name
$$;
REVOKE ALL ON FUNCTION public.setores_sem_responsavel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setores_sem_responsavel() TO authenticated;