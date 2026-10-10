import { ActionForm, SubmitButton } from "@/components/action-form";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/egrow-logo.png" alt="e-grow" className="mx-auto h-16 w-auto" />
          <div className="mt-2 inline-block rounded bg-accent-500 px-2 text-sm font-bold tracking-widest text-brand-800">CRM</div>
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
