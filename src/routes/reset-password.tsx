import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha — RS CONECT" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Senha alterada com sucesso. Agora você já pode entrar no RS CONECT.");
      setTimeout(() => void navigate({ to: "/auth" }), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
    <div className="mb-7 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sun className="size-7" /></span><h1 className="mt-4 text-2xl font-black">Nova senha</h1><p className="mt-2 text-sm text-muted-foreground">Defina uma nova senha para o RS CONECT.</p></div>
    {!ready ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Validando o link de recuperação...</p> : <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-1.5 text-sm font-medium">Nova senha<span className="relative block"><LockKeyhole className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="h-11 w-full rounded-lg border bg-background pl-10 pr-3" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></span></label>
      <label className="block space-y-1.5 text-sm font-medium">Confirmar senha<input className="mt-1 h-11 w-full rounded-lg border bg-background px-3" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}{message ? <p role="status" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{message}</p> : null}
      <Button className="h-11 w-full" type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
    </form>}
  </section></main>;
}
