import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Analyseur de CV : le PDF est envoyé à une Server Action (limite par
  // défaut : 1 Mo). 4,5 Mo = limite de Vercel pour le corps d'une requête.
  experimental: {
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // @hyzyla/pdfium (aperçu du CV, voir src/lib/pdf-preview.ts) charge son
  // binaire WebAssembly via __dirname à l'exécution : il ne doit pas être
  // réécrit dans les chunks webpack, et pdfium.wasm doit être inclus
  // explicitement dans la fonction déployée (même réglage que la
  // Plateforme des Compétences).
  serverExternalPackages: ["@hyzyla/pdfium"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@hyzyla/pdfium/dist/pdfium.wasm"],
  },
  async headers() {
    return [
      {
        // Mêmes en-têtes de sécurité de base que la Plateforme des Compétences.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
