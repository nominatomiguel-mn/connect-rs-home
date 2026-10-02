import { supabase } from "@/integrations/supabase/client";

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB

/** Envia fotos do chamado para o storage privado e devolve os caminhos. */
export async function uploadTicketPhotos(
  ticketId: string,
  files: File[],
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error(`A foto "${file.name}" passa de 10 MB. Escolha uma menor.`);
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `tickets/${ticketId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("chamados")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) {
      throw new Error("Não foi possível enviar as fotos. Tente novamente.");
    }
    paths.push(path);
  }
  return paths;
}

/** Gera links temporários (1 hora) para exibir fotos privadas. */
export async function signPhotoPaths(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    (paths ?? []).map(async (p) => {
      if (!p) return;
      const { data } = await supabase.storage.from("chamados").createSignedUrl(p, 60 * 60);
      if (data?.signedUrl) out[p] = data.signedUrl;
    }),
  );
  return out;
}
