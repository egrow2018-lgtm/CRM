import { ActionForm, SubmitButton } from "@/components/action-form";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold tracking-tight text-brand-700">
            e-grow <span className="font-light text-slate-500">CRM</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Inicia sesión para continuar</p>
        </div>
        <ActionForm action={login} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          <SubmitButton className="btn btn-primary w-full" pendingText="Ingresando…">
            Ingresar
          </SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
