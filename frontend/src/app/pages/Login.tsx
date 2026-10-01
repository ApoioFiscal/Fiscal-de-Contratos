import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, Building2, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { login, obterSessao, destinoInicialPorPerfil } from "@/services/auth";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const sessao = obterSessao();

    if (sessao) {
      navigate(destinoInicialPorPerfil(sessao.perfil), { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");

    if (!email.trim() || !senha.trim()) {
      setErro("Informe e-mail e senha para acessar o sistema.");
      return;
    }

    setIsLoading(true);

    try {
      const usuario = await login({ email: email.trim(), senha });
      navigate(destinoInicialPorPerfil(usuario.perfil), { replace: true });
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : "Erro ao conectar com o servidor.";
      setErro(mensagem);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.45),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.22),transparent_35%)]"
      />
      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">Fiscal de Contratos</p>
            </div>
          </div>

          <div className="relative max-w-2xl">
            <p className="mb-5 inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm text-sky-100">
              Plataforma de acompanhamento, auditoria e gestão contratual
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-white xl:text-6xl">
              Controle claro para licitações, contratos e fiscalização.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Acesse com seu perfil institucional para consultar dados, acompanhar solicitações e executar rotinas.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            {["Praticidade", "Segurança", "Agilidade"].map((item) => (
              <div key={item} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <CheckCircle2 className="mb-3 h-5 w-5 text-sky-200" aria-hidden="true" />
                <p className="text-sm font-medium text-white">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">Fiscal de Contratos</p>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-300/50 backdrop-blur sm:p-8">
              <div className="mb-8">
                <p className="text-sm font-medium text-blue-700">Acesso seguro</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Entre no sistema</h2>
              </div>

              <form className="space-y-5" onSubmit={handleLogin} noValidate>
                {erro && (
                  <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{erro}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-12 rounded-2xl border-slate-200 bg-white pl-11 text-slate-950 placeholder:text-slate-400"
                      placeholder="usuario@gmail.com"
                      disabled={isLoading}
                      aria-invalid={Boolean(erro)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                      id="senha"
                      name="senha"
                      type="password"
                      autoComplete="current-password"
                      required
                      minLength={6}
                      value={senha}
                      onChange={(event) => setSenha(event.target.value)}
                      className="h-12 rounded-2xl border-slate-200 bg-white pl-11 text-slate-950 placeholder:text-slate-400"
                      placeholder="Digite sua senha"
                      disabled={isLoading}
                      aria-invalid={Boolean(erro)}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full rounded-2xl bg-blue-700 text-base text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isLoading ? "Validando acesso..." : "Entrar"}
                </Button>
              </form>

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
