import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail, ShieldCheck, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — RS CONECT" }, { name: "description", content: "Acesso seguro ao RS CONECT." }] }),
  component: AuthPage,
});
function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); setError("");
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (authError) throw authError;
        await navigate({ to: "/home" });
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (authError) throw authError;
        if (data.session) await navigate({ to: "/home" });
        else { setMessage("Se a confirmação de e-mail estiver ativada, você receberá as instruções para concluir o cadastro."); setMode("login"); }
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir o acesso."); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-md">
    <div className="mb-8 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sun className="size-7" /></span><p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Colégio Raios de Sol</p><h1 className="mt-2 text-3xl font-black tracking-tight">RS CONECT</h1><p className="mt-2 text-sm text-muted-foreground">Acesso interno, simples e seguro.</p></div>
    <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><h2 className="text-xl font-bold">{mode === "login" ? "Bem-vindo de volta" : "Criar acesso"}</h2><p className="mb-6 mt-1 text-sm text-muted-foreground">{mode === "login" ? "Entre com seu e-mail e senha." : "Qualquer pessoa pode criar uma conta. Novas contas começam como colaborador."}</p>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block space-y-1.5 text-sm font-medium">E-mail<span className="relative block"><Mail className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@colegio.com.br" /></span></label>
        <label className="block space-y-1.5 text-sm font-medium">Senha<span className="relative block"><LockKeyhole className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></span></label>
        {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}{message ? <p role="status" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{message}</p> : null}
        <Button className="h-11 w-full" type="submit" disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Solicitar cadastro"}</Button>
      </form><div className="mt-5 border-t pt-4 text-center"><button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Criar uma conta" : "Já tenho uma conta — entrar"}</button></div>
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Novas contas entram como colaborador e podem ter permissões alteradas por administradores</p>
    </section></div></main>;
}