import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SessionInfo = {
  userId: string;
  email: string | null;
  fullName: string;
  roles: string[];
  responsibleSectors: { id: string; name: string }[];
};

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionInfo> => {
    const { supabase, userId, claims } = context;
    const email = (claims?.email as string | undefined) ?? null;

    const [profileRes, authorizedRes, rolesRes, respRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase.from("pessoas_autorizadas").select("nome").ilike("email", email ?? "").eq("ativo", true).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("sector_responsibles")
        .select("sector_id")
        .eq("user_id", userId),
    ]);

    const sectorIds = (respRes.data ?? []).map((r) => r.sector_id);
    const { data: sectorRows } = sectorIds.length
      ? await supabase.from("sectors").select("id, name").in("id", sectorIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((sectorRows ?? []).map((s) => [s.id, s.name]));

    const responsibleSectors = sectorIds
      .map((id) => ({ id, name: nameById.get(id) ?? "" }))
      .filter((s) => s.name);

    return {
      userId,
      email,
      fullName: authorizedRes.data?.nome?.trim() || profileRes.data?.full_name?.trim() || email || "Usuário",
      roles: (rolesRes.data ?? []).map((r) => r.role),
      responsibleSectors,
    };
  });

export function isAdmin(info: SessionInfo | undefined): boolean {
  return !!info?.roles.includes("admin");
}

export function isDirecao(info: SessionInfo | undefined): boolean {
  return !!info?.roles.includes("direcao");
}
