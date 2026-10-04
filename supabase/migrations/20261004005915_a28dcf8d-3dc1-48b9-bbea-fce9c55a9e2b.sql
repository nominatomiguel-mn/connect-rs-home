grant select, insert, update on public.recursos_reserva to authenticated;
grant select, update on public.reservas to authenticated;
grant all on public.recursos_reserva to service_role;
grant all on public.reservas to service_role;