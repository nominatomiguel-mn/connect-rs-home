import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function requireAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) {
    throw new Error("Acesso restrito aos administradores.");
  }
}

export const listAuthorized = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("authorized_emails")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar a lista de pessoas.");
    return data;
  });

export const addAuthorized = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email("E-mail inválido."),
        full_name: z.string().trim().min(2, "Informe o nome.").max(120),
        role: z.enum(["admin", "direcao", "responsavel", "colaborador"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("authorized_emails").upsert(
      {
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        active: true,
      },
      { onConflict: "email" },
    );
    if (error) throw new Error("Não foi possível salvar a pessoa. Tente novamente.");
    return { ok: true };
  });

export const setAuthorizedActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("authorized_emails")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar a pessoa.");
    return { ok: true };
  });

export const removeAuthorized = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("authorized_emails")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível remover a pessoa.");
    return { ok: true };
  });

export type AdminData = {
  sectors: {
    id: string;
    name: string;
    active: boolean;
    responsibles: { user_id: string; full_name: string; email: string | null }[];
  }[];
  users: { id: string; full_name: string; email: string | null; roles: string[] }[];
};

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminData> => {
    await requireAdmin(context.supabase, context.userId);
    const [sectorsRes, respRes, profilesRes, rolesRes] = await Promise.all([
      context.supabase.from("sectors").select("*").order("name"),
      context.supabase.from("sector_responsibles").select("sector_id, user_id"),
      context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (sectorsRes.error) throw new Error("Não foi possível carregar os setores.");

    const profileById = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p]),
    );

    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    const responsiblesBySector = new Map<string, AdminData["sectors"][number]["responsibles"]>();
    for (const r of respRes.data ?? []) {
      const list = responsiblesBySector.get(r.sector_id) ?? [];
      const profile = profileById.get(r.user_id);
      if (profile) {
        list.push({
          user_id: r.user_id,
          full_name: profile.full_name,
          email: profile.email,
        });
      }
      responsiblesBySector.set(r.sector_id, list);
    }

    return {
      sectors: (sectorsRes.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        active: s.active,
        responsibles: responsiblesBySector.get(s.id) ?? [],
      })),
      users: (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

export const setResponsible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sector_id: z.string().uuid(),
        user_id: z.string().uuid(),
        add: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.add) {
      const { error } = await context.supabase
        .from("sector_responsibles")
        .insert({ sector_id: data.sector_id, user_id: data.user_id });
      if (error) throw new Error("Não foi possível atribuir o responsável.");
      // Garante o papel "responsavel" para a pessoa atribuída.
      await context.supabase
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: "responsavel" }, {
          onConflict: "user_id,role",
        });
    } else {
      const { error } = await context.supabase
        .from("sector_responsibles")
        .delete()
        .eq("sector_id", data.sector_id)
        .eq("user_id", data.user_id);
      if (error) throw new Error("Não foi possível remover o responsável.");
    }
    return { ok: true };
  });

export const updateSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sector_id: z.string().uuid(),
        name: z.string().trim().min(2).max(80).optional(),
        active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: Database["public"]["Tables"]["sectors"]["Update"] = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.active !== undefined) patch["active"] = data.active;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("sectors")
      .update(patch)
      .eq("id", data.sector_id);
    if (error) throw new Error("Não foi possível atualizar o setor.");
    return { ok: true };
  });

export const createSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(2, "Informe o nome.").max(80) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sectors")
      .insert({ name: data.name });
    if (error) throw new Error("Não foi possível criar o setor (nome já existe?).");
    return { ok: true };
  });
