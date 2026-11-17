import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: "Prépa entretien et analyse de CV" };
// Les Server Actions appelées depuis cette page (coach, compte rendu,
// analyse de CV) interrogent l'API Claude et peuvent prendre plusieurs
// secondes — sans ça, Vercel Hobby coupe la fonction
// à 10 s par défaut.
export const maxDuration = 60;

export default function InterviewPrepPage() {
  return <AppShell />;
}
