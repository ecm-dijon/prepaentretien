"use client";

import { ArrowRight, FileText, Mic, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/interview-prep/app-header";

import { useNavigation } from "./navigation";

// Page d'accueil : deux grands boutons, un par outil.
export function HomeChooser() {
  const nav = useNavigation();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,var(--brand-50),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,var(--brand-800),transparent_65%)] dark:opacity-30"
          aria-hidden
        />
        <div className="w-full max-w-4xl space-y-8 sm:space-y-12">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Que voulez&#8209;vous préparer ?
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Deux outils pour décrocher votre alternance, avec l&apos;ECM.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <ChoiceButton
              onClick={() => nav?.open("entretien")}
              icon={<Mic className="size-7" />}
              title="Préparer un entretien"
              description="Passez un entretien simulé avec un recruteur et recevez les conseils d'un coach après chaque réponse."
              cta="Commencer la simulation"
            />
            <ChoiceButton
              onClick={() => nav?.open("cv")}
              icon={<FileText className="size-7" />}
              title="Analyser mon CV"
              description="Comparez votre CV au CV type de l'ECM et obtenez des pistes concrètes pour l'améliorer."
              cta="Analyser mon CV"
            />
          </div>

          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
            Aucun compte, rien n&apos;est conservé.{" "}
            <a
              href="/confidentialite"
              target="_blank"
              rel="noopener"
              className="font-medium text-primary underline underline-offset-4"
            >
              Confidentialité
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function ChoiceButton({
  onClick,
  icon,
  title,
  description,
  cta,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-3xl border border-border bg-card p-6 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:gap-5 sm:p-8"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        {icon}
      </span>
      <span className="space-y-2">
        <span className="block text-xl font-semibold sm:text-2xl">{title}</span>
        <span className="block text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}
