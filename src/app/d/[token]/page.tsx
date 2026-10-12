import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findLink, readConsent } from "@/lib/doc-links";
import { getCompanySettings } from "@/lib/settings";
import { quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { DocumentViewer } from "./viewer";
import { ConsentGate } from "./consent-gate";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "Documento · e-grow", robots: { index: false, follow: false } };

/** Visor público de un documento o cotización compartidos con un enlace rastreado. */
export default async function SharedDocumentPage({ params }: Props) {
  const { token } = await params;
  const link = await findLink(token);
  if (!link || (!link.document && !link.quote)) notFound();

  const brand = link.quote ? ((link.quote.snapshot as unknown as QuoteSnapshot).brand ?? null) : null;
  const title = link.document ? link.document.name : `Cotización ${quoteCode(link.quote!.year, link.quote!.number)}`;
  const color = brand?.primary ?? "#1c315e";

  if (link.document?.consentRequired && !(await readConsent(link.id))) {
    const company = await getCompanySettings();
    const who = company.legalName || company.name;
    return (
      <ConsentGate
        token={token}
        title={title}
        askEmail={!link.contactId}
        text={`Autorizo a ${who} a registrar mi consulta de este documento y a tratar mis datos personales conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador, para darme seguimiento comercial. Puedo ejercer mis derechos de acceso, rectificación, eliminación y oposición en cualquier momento${company.email ? ` escribiendo a ${company.email}` : ""}.`}
      />
    );
  }

  const isPdf = link.quote || link.document?.mimeType === "application/pdf";
  return (
    <DocumentViewer
      token={token}
      title={title}
      color={color}
      brandName={brand?.name ?? null}
      isPdf={!!isPdf}
      fileName={link.document?.fileName ?? `${title}.pdf`}
      allowDownload={link.quote ? true : link.document!.allowDownload}
    />
  );
}
