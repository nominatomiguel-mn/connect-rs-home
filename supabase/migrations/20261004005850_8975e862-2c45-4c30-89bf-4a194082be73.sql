create policy "Reservas: somente pessoa ativa" on public.recursos_reserva as restrictive
for all to authenticated
using (public.is_active_authorized_user(auth.uid()))
with check (public.is_active_authorized_user(auth.uid()));

create or replace function public.listar_reservas(
  _inicio timestamptz,
  _fim timestamptz
)
returns table (
  id uuid,
  recurso_id uuid,
  created_by uuid,
  inicio timestamptz,
  fim timestamptz,
  finalidade text,
  status public.reservation_status,
  created_at timestamptz,
  reservante_nome text
)
language sql
security definer
set search_path = public
as $$
  select r.id,r.recurso_id,r.created_by,r.inicio,r.fim,r.finalidade,r.status,r.created_at,
         coalesce(p.full_name,'Usuário') as reservante_nome
  from public.reservas r
  left join public.profiles p on p.id=r.created_by
  where public.is_active_authorized_user(auth.uid())
    and r.inicio < _fim
    and r.fim > _inicio
  order by r.inicio;
$$;
grant execute on function public.listar_reservas(timestamptz,timestamptz) to authenticated;

revoke insert, update, delete on public.reservas from authenticated;