import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { InterviewPrepApp } from "@/components/interview-prep/interview-prep-app";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Prépa entretien" };
// Les Server Actions appelées depuis cette page interrogent l'API Claude et
// peuvent prendre quelques secondes — sans ça, Vercel Hobby coupe la fonction
// à 10 s par défaut.
export const maxDuration = 60;

export default function InterviewPrepPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 shadow-soft backdrop-blur-md sm:px-6">
        <Logo />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex-1 p-4 sm:p-6 lg:p-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,var(--brand-50),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,var(--brand-800),transparent_65%)] dark:opacity-30"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight">Prépa entretien</h1>
            <p className="text-muted-foreground">
              Simulez un entretien avec le coach IA : décrivez le poste visé, répondez à ses questions et
              recevez des retours pour vous améliorer. À la fin, téléchargez votre compte rendu en PDF.
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
              Aucun compte, aucun stockage : la session est effacée dès que vous quittez la page.
            </p>
          </div>
          <InterviewPrepApp />
        </div>
      </main>
    </div>
  );
}
