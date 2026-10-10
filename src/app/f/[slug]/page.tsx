import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseFormFields } from "@/lib/forms-builder";
import { PublicForm } from "./public-form";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ embed?: string }> };

async function getForm(slug: string) {
  return prisma.form.findUnique({ where: { slug }, include: { businessLine: { select: { name: true } } } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const form = await getForm((await params).slug);
  if (!form) return { title: "Formulario no encontrado" };
  return {
    title: `${form.title} · e-grow`,
    description: form.description ?? undefined,
    openGraph: { title: form.title, description: form.description ?? undefined, siteName: "e-grow", images: ["/egrow-logo.png"] },
  };
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const [{ slug }, { embed }] = await Promise.all([params, searchParams]);
  const form = await getForm(slug);
  if (!form) notFound();
  const isEmbed = embed === "1";

  return (
    <main className={isEmbed ? "bg-white p-4" : "min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 py-10"}>
      <div className={isEmbed ? "" : "mx-auto max-w-xl"}>
        {!isEmbed && (
          <div className="mb-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/egrow-logo.png" alt="e-grow" className="mx-auto h-14 w-auto" />
          </div>
        )}
        <div className={isEmbed ? "" : "card p-6 sm:p-8"}>
          {form.businessLine && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-700">{form.businessLine.name}</div>
          )}
          <h1 className="text-2xl font-semibold text-brand-700">{form.title}</h1>
          {form.description && <p className="mt-2 whitespace-pre-line text-slate-600">{form.description}</p>}
          <div className="mt-6">
            {form.active ? (
              <PublicForm slug={form.slug} fields={parseFormFields(form.fields)} submitLabel={form.submitLabel} successMessage={form.successMessage} />
            ) : (
              <p className="rounded-lg bg-slate-100 px-4 py-6 text-center text-slate-600">Este formulario ya no recibe respuestas.</p>
            )}
          </div>
        </div>
        {!isEmbed && (
          <p className="mt-6 text-center text-xs text-slate-400">
            <a href="https://www.e-growonline.com" className="hover:underline">e-growonline.com</a>
          </p>
        )}
      </div>
    </main>
  );
}
