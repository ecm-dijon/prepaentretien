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

import { InterviewPrepChat } from "./interview-prep-chat";
import { SetupForm } from "./setup-form";
import { SummaryView } from "./summary-view";
import { EMPTY_STUDENT, type Message, type StudentForm } from "./types";

type Phase = "setup" | "chat" | "summary";

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
    void recordSessionStartedAction(profileFilled).catch(() => {});
  }

  function summarize() {
    if (!completedRecordedRef.current) {
      completedRecordedRef.current = true;
      const answers = messages.filter((m) => m.role === "user").length;
      const durationSec = (Date.now() - startedAtRef.current) / 1000;
      void recordSessionCompletedAction(answers, durationSec).catch(() => {});
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
    return <SetupForm value={student} onChange={setStudent} onStart={handleStart} />;
  }

  if (phase === "summary") {
    return (
      <SummaryView
        summary={summary}
        messages={messages}
        studentName={context.firstName}
        retrying={summarizing}
        onRetrySummary={summarize}
        onDownloaded={() => {
          if (!downloaded) void recordPdfDownloadedAction().catch(() => {});
          setDownloaded(true);
        }}
        onNewSession={handleNewSession}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <InterviewPrepChat
        messages={messages}
        setMessages={setMessages}
        student={context}
        ending={summarizing}
        onEnd={summarize}
      />
    </div>
  );
}
