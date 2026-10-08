import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "e-grow CRM",
  description: "CRM de e-grow: negocios, contactos, empresas y líneas de negocio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
