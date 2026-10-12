import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@react-pdf/renderer", "exceljs"],
  // pdfkit (usado por @react-pdf) carga sus fuentes estándar con imports dinámicos ("#standard-fonts/*")
  // que el rastreo de archivos de Vercel no detecta: se incluyen a mano en todas las rutas
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/lib/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
