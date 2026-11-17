"use client";

import { useCallback, useState } from "react";

import { CvAnalyzer } from "@/components/cv/cv-analyzer";
import { InterviewPrepApp, type InterviewPrefill } from "@/components/interview-prep/interview-prep-app";
import type { StudentForm } from "@/components/interview-prep/types";

import { HomeChooser } from "./home-chooser";
import { NavigationProvider, useNavigation } from "./navigation";

// Les deux outils restent montés (simplement masqués) quand on revient à
// l'accueil : une simulation ou une analyse en cours n'est pas perdue.
// Tout reste en mémoire dans la page, rien n'est stocké.
export function AppShell() {
  return (
    <NavigationProvider>
      <Screens />
    </NavigationProvider>
  );
}

function Screens() {
  const nav = useNavigation();
  const mode = nav?.mode ?? "home";
  const [prefill, setPrefill] = useState<InterviewPrefill | null>(null);

  const prepareInterview = useCallback(
    (form: Partial<StudentForm>) => {
      setPrefill({ id: Date.now(), form });
      nav?.open("entretien");
    },
    [nav]
  );

  return (
    <>
      <div hidden={mode !== "home"}>
        <HomeChooser />
      </div>
      <div hidden={mode !== "entretien"}>
        <InterviewPrepApp prefill={prefill} />
      </div>
      <div hidden={mode !== "cv"}>
        <CvAnalyzer onPrepareInterview={prepareInterview} />
      </div>
    </>
  );
}
