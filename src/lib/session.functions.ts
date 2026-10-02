import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SessionInfo = {
  userId: string;
  email: string | null;
  fullName: string;
  roles: string[];
  responsibleSectors: { id: string; name: string }[];
  sectors: { id: string; name: string }[];
};

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionInfo> => {
    const { supabase, userId, claims } = context;
    const email = (claims?.email as string | undefined) ?? null;

    const [profileRes, rolesRes, respRes, sectorsRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("sector_responsibles")
        .select("sector_id, sector:sectors(id, name)")
        .eq("user_id", userId),
      supabase
        .from("user_sectors")
        .select("sector_id, sector:sectors(id, name)")
        .eq("user_id", userId),
    ]);

    const responsibleSectors = (respRes.data ?? [])
      .map((r) => ({ id: r.sector_id, name: r.sector?.name ?? "" }))
      .filter((s) => s.name);

    const sectors = (sectorsRes.data ?? [])
      .map((r) => ({ id: r.sector_id, name: r.sector?.name ?? "" }))
      .filter((sector) => sector.name);

    return {
      userId,
      email,
      fullName: profileRes.data?.full_name ?? email ?? "Usuário",
      roles: (rolesRes.data ?? []).map((r) => r.role),
      responsibleSectors,
      sectors,
    };
  });

export function isAdmin(info: SessionInfo | undefined): boolean {
  return !!info?.roles.includes("admin");
}

export function isDirecao(info: SessionInfo | undefined): boolean {
  return !!info?.roles.includes("direcao");
}
