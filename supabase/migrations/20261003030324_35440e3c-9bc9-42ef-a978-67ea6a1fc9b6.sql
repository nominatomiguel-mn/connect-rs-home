alter function public.block_decision_mutation() set search_path = public;
alter function public.set_solicitacao_updated_at() set search_path = public;
alter function public.validate_solicitacao_details() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.record_ticket_created() set search_path = public;
alter function public.record_ticket_status() set search_path = public;

revoke execute on function public.decidir_solicitacao(uuid,public.request_status,text) from anon;
revoke execute on function public.has_role(uuid,public.app_role) from anon;
revoke execute on function public.can_view_ticket(uuid,uuid) from anon;
revoke execute on function public.is_active_authorized_user(uuid) from anon;

revoke execute on function public.block_decision_mutation() from anon, authenticated;
revoke execute on function public.set_solicitacao_updated_at() from anon, authenticated;
revoke execute on function public.validate_solicitacao_details() from anon, authenticated;
revoke execute on function public.guard_solicitacao_update() from anon, authenticated;
revoke execute on function public.guard_ticket_update() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.record_ticket_created() from anon, authenticated;
revoke execute on function public.record_ticket_status() from anon, authenticated;