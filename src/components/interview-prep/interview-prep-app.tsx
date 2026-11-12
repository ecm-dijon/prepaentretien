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

import { AppHeader } from "./app-header";
import { InterviewPrepChat } from "./interview-prep-chat";
import { SetupForm } from "./setup-form";
import { SummaryView } from "./summary-view";
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
export function InterviewPrepApp() {
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

  const hasUnsavedWork =
    (phase === "chat" && messages.some((m) => m.role === "user")) || (phase === "summary" && !downloaded);

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

// Étapes « départ » et « compte rendu » : page qui défile normalement, même
// barre du haut que le chat, contenu dans une colonne centrée.
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="relative flex-1 px-3 py-6 sm:px-6 sm:py-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,var(--brand-50),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,var(--brand-800),transparent_65%)] dark:opacity-30"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
