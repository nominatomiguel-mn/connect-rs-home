-- Reservas: toda alteração passa pelo fluxo de cancelamento protegido
revoke insert, update, delete on public.reservas from authenticated;
