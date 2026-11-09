"use client";

import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendInterviewPrepMessageAction, type StudentContext } from "@/lib/actions/interview-prep";
import { PRE_INTERVIEW_CHECKLIST_MESSAGE } from "@/lib/ai/interview-prep-checklist";
import { cn } from "@/lib/utils";

import { AppHeader } from "./app-header";
import type { Message } from "./types";

const MAX_INPUT_HEIGHT = 220;

// Interface pleine page façon messagerie : seule la liste des messages
// défile (sur toute la largeur de la fenêtre), le contenu reste dans une
// colonne centrée lisible, et la zone de saisie reste ancrée en bas.
export function InterviewPrepChat({
  messages,
  setMessages,
  student,
  sessionId,
  ending,
  onEnd,
}: {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  student: StudentContext;
  sessionId: string;
  ending: boolean;
  onEnd: () => void;
}) {
  const [input, setInput] = useState("");
  const [sending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // Zone de saisie qui s'agrandit avec le texte (jusqu'à une hauteur max).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [input]);

  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  const userTurns = messages.filter((m) => m.role === "user").length;

  function handleSend() {
    const content = input.trim();
    if (!content || sending || ending) return;

    const previous = messages;
    setMessages([...previous, { role: "user", content }]);
    setInput("");

    startSending(async () => {
      const result = await sendInterviewPrepMessageAction(previous, content, student, sessionId);
      if (result.success) {
        setMessages((prev) => [
          ...prev,
          ...result.replies.map((reply): Message => ({ role: "assistant", content: reply })),
        ]);
      } else {
        // Rien n'est stocké côté serveur : on retire le message non traité
        // et on le remet dans la zone de saisie pour pouvoir le renvoyer.
        setMessages(previous);
        setInput(content);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex h-svh flex-col">
      <AppHeader
        center={
          userTurns === 0
            ? "Simulation d'entretien"
            : `Simulation en cours · ${userTurns} réponse${userTurns > 1 ? "s" : ""}`
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ending || sending || userTurns === 0}
            onClick={onEnd}
          >
            {ending ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
            <span className="hidden sm:inline">{ending ? "Compte rendu en cours..." : "Terminer la session"}</span>
            <span className="sm:hidden">Terminer</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
          {(() => {
            // Le rappel "prenez des notes" ne doit apparaître qu'après une
            // vraie réponse de coaching (donc une fois l'entretien
            // effectivement démarré) — pas après le message d'ouverture ni
            // après les rappels avant-entretien eux-mêmes (comparés tels
            // quels : ce message est statique, jamais généré par l'IA).
            let userTurnSeen = false;
            return messages.map((message, i) => {
              const isChecklistMessage = message.content === PRE_INTERVIEW_CHECKLIST_MESSAGE;
              const showNoteReminder = message.role === "assistant" && userTurnSeen && !isChecklistMessage;
              if (message.role === "user") userTurnSeen = true;

              if (message.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-3xl bg-muted px-5 py-3 text-[15px] leading-relaxed whitespace-pre-line">
                      {message.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="flex gap-3 sm:gap-4">
                  <CoachAvatar />
                  <div className="min-w-0 flex-1 pt-1">
                    <div
                      className={cn(
                        "text-[15px] leading-relaxed whitespace-pre-line",
                        isChecklistMessage && "rounded-2xl border border-border bg-accent/40 px-5 py-4"
                      )}
                    >
                      {message.content}
                    </div>
                    {showNoteReminder && (
                      <p className="mt-2 text-xs font-medium text-destructive">⚠️ Pensez à prendre des notes !</p>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {sending && (
            <div className="flex gap-3 sm:gap-4">
              <CoachAvatar />
              <div className="flex items-center gap-2 pt-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Le coach écrit...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 bg-background px-4 pb-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-3xl border border-border bg-card p-2 pl-5 shadow-soft focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={userTurns === 0 ? "Décrivez le poste visé (intitulé, entreprise, secteur)..." : "Écrivez votre réponse..."}
              rows={1}
              disabled={ending}
              autoFocus
              aria-label="Votre message"
              className="max-h-[220px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              type="button"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              onClick={handleSend}
              disabled={sending || ending || !input.trim()}
              aria-label="Envoyer"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Entrée pour envoyer · Maj + Entrée pour aller à la ligne · Rien n&apos;est conservé après la
            fermeture de la page.
          </p>
        </div>
      </div>
    </div>
  );
}

function CoachAvatar() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Mic className="size-4" />
    </span>
  );
}
