"use client";

import { AppHeader } from "@/components/interview-prep/app-header";

// Étapes « départ » et « compte rendu » : page qui défile normalement, même
// barre du haut que le chat, contenu dans une colonne centrée.
export function PageShell({
  children,
  width = "max-w-3xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="relative flex-1 px-3 py-6 sm:px-6 sm:py-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,var(--brand-50),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,var(--brand-800),transparent_65%)] dark:opacity-30"
          aria-hidden
        />
        <div className={`mx-auto w-full ${width}`}>{children}</div>
      </main>
    </div>
  );
}
