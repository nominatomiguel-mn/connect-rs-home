-- Restringe execução direta das funções internas
revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.can_view_ticket(uuid, uuid) from public;
revoke execute on function public.handle_new_user() from public;

-- Usuários conectados precisam chamar as funções de verificação (usadas nas políticas)
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.can_view_ticket(uuid, uuid) to authenticated;

-- search_path fixo também na função de timestamp
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;
