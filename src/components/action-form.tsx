"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  resetOnSuccess?: boolean;
  children: React.ReactNode;
};

const PendingContext = createContext(false);

/**
 * Formulario conectado a una server action que muestra el error devuelto.
 * Se envía con onSubmit (y no con la prop `action`) para que React no vacíe
 * los campos cuando la acción devuelve un error de validación.
 */
export function ActionForm({ action, resetOnSuccess, children, ...rest }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {state?.error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

function usePending() {
  const { pending } = useFormStatus();
  const transitionPending = useContext(PendingContext);
  return pending || transitionPending;
}

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText = "Guardando…",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const pending = usePending();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Botón que pide confirmación antes de enviar el formulario (por ejemplo, para eliminar). */
export function ConfirmButton({
  message,
  children,
  className = "btn btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pending = usePending();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
