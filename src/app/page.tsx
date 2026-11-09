import type { Metadata } from "next";

import { InterviewPrepApp } from "@/components/interview-prep/interview-prep-app";

export const metadata: Metadata = { title: "Prépa entretien" };
// Les Server Actions appelées depuis cette page interrogent l'API Claude et
// peuvent prendre quelques secondes — sans ça, Vercel Hobby coupe la fonction
// à 10 s par défaut.
export const maxDuration = 60;

export default function InterviewPrepPage() {
  return <InterviewPrepApp />;
}
