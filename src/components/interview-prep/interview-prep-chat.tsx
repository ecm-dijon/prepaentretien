"use client";

import { Loader2, Send, Square } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { sendInterviewPrepMessageAction, type StudentContext } from "@/lib/actions/interview-prep";
import { PRE_INTERVIEW_CHECKLIST_MESSAGE } from "@/lib/ai/interview-prep-checklist";
import { cn } from "@/lib/utils";

import type { Message } from "./types";

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userTurns = messages.filter((m) => m.role === "user").length;

  function handleSend() {
    const content = input.trim();
    if (!content || sending) return;

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
    // Hauteur bornée à la fenêtre (moins un peu de marge pour l'en-tête et le
    // titre de page) plutôt qu'un empilement classique : avant, la zone de
    // messages pouvait grandir jusqu'à 70vh *avant* la zone de saisie, qui se
    // retrouvait poussée sous la ligne de flottaison et demandait de
    // descendre pour la voir. Ici seule la liste de messages défile ; la
    // zone de saisie reste toujours visible, ancrée en bas.
    <div className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col">
      <Card className="flex flex-1 flex-col overflow-hidden pb-0 shadow-soft">
        <CardContent className="flex-1 space-y-4 overflow-y-auto py-6">
          {(() => {
            // Le rappel "prends des notes" ne doit apparaître qu'après une
            // vraie réponse de coaching (donc une fois l'entretien
            // effectivement démarré) — pas après le message d'ouverture ni
            // après les rappels avant-entretien eux-mêmes (comparés tels
            // quels : ce message est statique, jamais généré par l'IA).
            let userTurnSeen = false;
            return messages.map((message, i) => {
              const isChecklistMessage = message.content === PRE_INTERVIEW_CHECKLIST_MESSAGE;
              const showNoteReminder = message.role === "assistant" && userTurnSeen && !isChecklistMessage;
              if (message.role === "user") userTurnSeen = true;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-accent-foreground"
                    )}
                  >
                    {message.content}
                  </div>
                  {showNoteReminder && (
                    <p className="mt-1 max-w-[85%] text-xs font-medium text-destructive">
                      ⚠️ Pensez à prendre des notes !
                    </p>
                  )}
                </div>
              );
            });
          })()}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Le coach écrit...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        <div className="flex shrink-0 items-end gap-2 border-t border-border px-6 py-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Écrivez votre réponse..."
            rows={2}
            disabled={sending || ending}
            className="flex-1"
          />
          <Button type="button" size="icon" onClick={handleSend} disabled={sending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </Card>

      <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {userTurns === 0
            ? "Décrivez le poste visé pour démarrer la simulation."
            : `${userTurns} réponse${userTurns > 1 ? "s" : ""} dans cette session.`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ending || sending || userTurns === 0}
          onClick={onEnd}
        >
          {ending ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
          Terminer la session
        </Button>
      </div>
    </div>
  );
}
