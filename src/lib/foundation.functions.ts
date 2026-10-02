import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "direcao" | "responsavel" | "colaborador";
const dbForFoundation = (client: SupabaseClient<any>) => client as SupabaseClient<any>;
async function requireAdmin(client: SupabaseClient<any>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito aos administradores.");
}

export const listSectorsForAuthorization = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = dbForFoundation(context.supabase); await requireAdmin(db, context.userId);
  const { data, error } = await db.from("sectors").select("id, name, active").order("name");
  if (error) throw new Error("Não foi possível carregar os setores.");
  return data ?? [];
});

export const listAuthorizedPeople = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = dbForFoundation(context.supabase); await requireAdmin(db, context.userId);
  const [peopleRes, profilesRes] = await Promise.all([
    db.from("pessoas_autorizadas").select("*").order("nome"),
    db.from("profiles").select("id, email"),
  ]);
  if (peopleRes.error) throw new Error("Não foi possível carregar as pessoas autorizadas.");
  if (profilesRes.error) throw new Error("Não foi possível verificar as contas cadastradas.");
  const profileByEmail = new Map((profilesRes.data ?? []).map((p: { id: string; email: string | null }) => [(p.email ?? "").toLowerCase(), p.id]));
  return (peopleRes.data ?? []).map((person: any) => ({ ...person, registered: profileByEmail.has(String(person.email).toLowerCase()), user_id: profileByEmail.get(String(person.email).toLowerCase()) ?? null }));
});

const personSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  nome: z.string().trim().min(2, "Informe o nome.").max(120),
  papel: z.enum(["admin", "direcao", "responsavel", "colaborador"]),
  setores: z.array(z.string().uuid()).default([]),
  ativo: z.boolean().default(true),
});

export const saveAuthorizedPerson = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => personSchema.parse(input)).handler(async ({ context, data }) => {
  const db = dbForFoundation(context.supabase); await requireAdmin(db, context.userId);
  const { data: validSectors, error: sectorsError } = await db.from("sectors").select("id").in("id", data.setores);
  if (sectorsError) throw new Error("Não foi possível validar os setores selecionados.");
  if ((validSectors ?? []).length !== data.setores.length) throw new Error("Um ou mais setores selecionados não existem.");
  const { data: existingProfiles, error: profileLookupError } = await db.from("profiles").select("id, email").eq("email", data.email);
  if (profileLookupError) throw new Error("Não foi possível verificar a conta vinculada.");
  const payload = { email: data.email, nome: data.nome, papel: data.papel as Role, setores: data.setores, ativo: data.ativo, updated_at: new Date().toISOString() };
  let savedId = data.id;
  if (data.id) {
    const { error } = await db.from("pessoas_autorizadas").update(payload).eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar a pessoa autorizada.");
  } else {
    const { data: saved, error } = await db.from("pessoas_autorizadas").upsert(payload, { onConflict: "email" }).select("id").single();
    if (error) throw new Error("Não foi possível cadastrar a pessoa autorizada.");
    savedId = saved.id;
  }
  const profile = (existingProfiles ?? [])[0];
  if (profile) {
    const { error: profileError } = await db.from("profiles").update({ full_name: data.nome }).eq("id", profile.id);
    if (profileError) throw new Error("Pessoa salva, mas não foi possível atualizar o perfil.");
    const { error: deleteRolesError } = await db.from("user_roles").delete().eq("user_id", profile.id);
    if (deleteRolesError) throw new Error("Pessoa salva, mas não foi possível atualizar o papel.");
    const { error: insertRoleError } = await db.from("user_roles").insert({ user_id: profile.id, role: data.papel });
    if (insertRoleError) throw new Error("Pessoa salva, mas não foi possível atribuir o papel.");
    const { error: clearSectorsError } = await db.from("user_sectors").delete().eq("user_id", profile.id);
    if (clearSectorsError) throw new Error("Pessoa salva, mas não foi possível atualizar os setores.");
    if (data.setores.length) {
      const { error: insertSectorsError } = await db.from("user_sectors").insert(data.setores.map((sector_id) => ({ user_id: profile.id, sector_id })));
      if (insertSectorsError) throw new Error("Pessoa salva, mas não foi possível atribuir os setores.");
    }
  }
  return { ok: true, id: savedId };
});

export const setAuthorizedPersonActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input)).handler(async ({ context, data }) => {
  const db = dbForFoundation(context.supabase); await requireAdmin(db, context.userId);
  const { error } = await db.from("pessoas_autorizadas").update({ ativo: data.ativo, updated_at: new Date().toISOString() }).eq("id", data.id);
  if (error) throw new Error("Não foi possível alterar o acesso da pessoa.");
  return { ok: true };
});
