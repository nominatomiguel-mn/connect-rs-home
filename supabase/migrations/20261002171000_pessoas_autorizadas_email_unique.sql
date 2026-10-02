-- A API PostgREST usa o campo email como chave de conflito nos upserts.
-- O índice case-insensitive já protege contra duplicatas com diferenças de caixa;
-- este índice adicional permite upsert(email) sem perder essa proteção.
create unique index if not exists pessoas_autorizadas_email_uidx
  on public.pessoas_autorizadas (email);
