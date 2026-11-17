"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  summarizeInterviewPrepAction,
  type StudentContext,
} from "@/lib/actions/interview-prep";
import {
  recordPdfDownloadedAction,
  recordSessionCompletedAction,
  recordSessionStartedAction,
} from "@/lib/actions/usage";
import type { InterviewPrepSummary } from "@/lib/ai/interview-prep";
import { openingMessage } from "@/lib/opening-message";

import { PageShell } from "@/components/app/page-shell";

import { InterviewPrepChat } from "./interview-prep-chat";
import { SetupForm } from "./setup-form";
import { preloadPdfModules, SummaryView } from "./summary-view";
import { unlockSpeech } from "./use-speech";
import { UsageNotice } from "./usage-notice";
import { EMPTY_STUDENT, type Message, type StudentForm } from "./types";

type Phase = "setup" | "chat" | "summary";

// UUID v4 aléatoire (crypto.randomUUID n'existe pas sur certains navigateurs anciens).
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function toContext(form: StudentForm): StudentContext {
  const list = (value: string, separator: RegExp, max: number, maxLength: number) =>
    Array.from(
      new Set(
        value
          .split(separator)
          .map((item) => item.trim().slice(0, maxLength))
          .filter(Boolean)
      )
    ).slice(0, max);

  return {
    firstName: form.firstName.trim(),
    headline: form.headline.trim(),
    degree: form.degree,
    currentYear: form.currentYear,
    skills: list(form.skills, /[,\n]/, 40, 80),
    experiences: list(form.experiences, /\n/, 20, 200),
  };
}

// Toute la session vit uniquement dans cet état React : aucun compte, aucune
// base, aucun stockage navigateur. Quitter ou recharger la page efface tout.
// Informations venant de l'analyseur de CV (« Préparer un entretien avec ce
// CV ») : appliquées au formulaire de départ, en mémoire uniquement.
export type InterviewPrefill = { id: number; form: Partial<StudentForm> };

export function InterviewPrepApp({ prefill }: { prefill?: InterviewPrefill | null }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [student, setStudent] = useState<StudentForm>(EMPTY_STUDENT);
  const [context, setContext] = useState<StudentContext>(toContext(EMPTY_STUDENT));
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState<InterviewPrepSummary | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [summarizing, startSummarizing] = useTransition();
  // Statistiques anonymes : début de la simulation et « déjà comptée comme
  // terminée » (le compte rendu peut être régénéré sans recompter).
  const startedAtRef = useRef(0);
  // Identifiant aléatoire de la simulation, uniquement pour les statistiques
  // anonymes : nouveau à chaque simulation, jamais stocké dans le navigateur.
  const [sessionId, setSessionId] = useState("");
  const completedRecordedRef = useRef(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    if (!prefill) return;
    if (phaseRef.current !== "setup") {
      toast("Une simulation est en cours : les informations du CV serviront pour la prochaine.");
      return;
    }
    setStudent((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(prefill.form) as [keyof StudentForm, string][]) {
        if (value) next[key] = value;
      }
      return next;
    });
    toast.success("Les informations de votre CV ont été reprises dans le formulaire.");
  }, [prefill]);

  const hasUnsavedWork =
    (phase === "chat" && messages.some((m) => m.role === "user")) || (phase === "summary" && !downloaded);

  // Charge le générateur de PDF dès l'ouverture de la page (voir
  // preloadPdfModules) pour que le téléchargement fonctionne même si le site
  // est mis à jour pendant la simulation.
  useEffect(() => {
    const id = setTimeout(() => void preloadPdfModules().catch(() => {}), 2000);
    return () => clearTimeout(id);
  }, []);

  // Avertit avant de quitter / recharger : tout serait perdu.
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  function handleStart() {
    unlockSpeech(); // iOS/Safari : la voix doit être débloquée par un clic
    const ctx = toContext(student);
    setContext(ctx);
    setMessages([{ role: "assistant", content: openingMessage(ctx.firstName) }]);
    setSummary(null);
    setDownloaded(false);
    setPhase("chat");
    startedAtRef.current = Date.now();
    completedRecordedRef.current = false;
    const profileFilled = Boolean(
      ctx.headline || ctx.degree || ctx.currentYear || ctx.skills.length || ctx.experiences.length
    );
    const id = randomId();
    setSessionId(id);
    void recordSessionStartedAction(id, profileFilled).catch(() => {});
  }

  function summarize() {
    if (!completedRecordedRef.current) {
      completedRecordedRef.current = true;
      const answers = messages.filter((m) => m.role === "user").length;
      const durationSec = (Date.now() - startedAtRef.current) / 1000;
      void recordSessionCompletedAction(sessionId, answers, durationSec).catch(() => {});
    }
    startSummarizing(async () => {
      const result = await summarizeInterviewPrepAction(messages);
      if (result.success) {
        setSummary(result.summary);
      } else {
        toast.error(result.error);
      }
      setPhase("summary");
    });
  }

  function handleNewSession() {
    if (!downloaded && !window.confirm("Le compte rendu n'a pas été téléchargé et sera perdu. Continuer ?")) {
      return;
    }
    setMessages([]);
    setSummary(null);
    setPhase("setup");
  }

  if (phase === "setup") {
    return (
      <PageShell>
        <div className="mb-6 space-y-2 text-center sm:mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Préparez votre entretien d&apos;alternance</h1>
          <p className="text-muted-foreground">
            Le coach IA joue le rôle du recruteur, vous donne un retour après chaque réponse et vous
            remet un compte rendu à télécharger à la fin.
          </p>
        </div>
        <div className="mb-5 sm:mb-6">
          <UsageNotice />
        </div>
        <SetupForm value={student} onChange={setStudent} onStart={handleStart} />
      </PageShell>
    );
  }

  if (phase === "summary") {
    return (
      <PageShell>
        <SummaryView
          summary={summary}
          messages={messages}
          studentName={context.firstName}
          retrying={summarizing}
          onRetrySummary={summarize}
          onDownloaded={() => {
            if (!downloaded) void recordPdfDownloadedAction(sessionId).catch(() => {});
            setDownloaded(true);
          }}
          onNewSession={handleNewSession}
        />
      </PageShell>
    );
  }

  return (
    <InterviewPrepChat
      messages={messages}
      setMessages={setMessages}
      student={context}
      sessionId={sessionId}
      ending={summarizing}
      onEnd={summarize}
    />
  );
}
