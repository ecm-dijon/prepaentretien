"use client";

import { ArrowUp, Briefcase, Lightbulb, Loader2, Mic, MicOff, Square, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendInterviewPrepMessageAction, type StudentContext } from "@/lib/actions/interview-prep";
import { PRE_INTERVIEW_CHECKLIST_MESSAGE } from "@/lib/ai/interview-prep-checklist";
import { splitCoachMessage } from "@/lib/coach-message";
import { cn } from "@/lib/utils";

import { AppHeader } from "./app-header";
import type { Message } from "./types";
import { UsageNotice } from "./usage-notice";
import { useDictation } from "./use-dictation";
import { unlockSpeech, useSpeech } from "./use-speech";

const MAX_INPUT_HEIGHT = 220;

// Écran tactile (téléphone, tablette) : Entrée y fait un retour à la ligne
// et on n'ouvre pas le clavier automatiquement.
function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

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
  const [noticeVisible, setNoticeVisible] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputValueRef = useRef("");
  inputValueRef.current = input;

  // Voix du recruteur : ses questions sont lues à voix haute (désactivable).
  const speech = useSpeech();
  const speechEnabledRef = useRef(speech.enabled);
  speechEnabledRef.current = speech.enabled;

  const dictation = useDictation({
    getText: useCallback(() => inputValueRef.current, []),
    setText: setInput,
    onError: useCallback((message: string) => toast.error(message), []),
  });

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
    if (!sending && !isTouchDevice()) inputRef.current?.focus();
  }, [sending]);

  const userTurns = messages.filter((m) => m.role === "user").length;

  function handleSend() {
    const content = input.trim();
    if (!content || sending || ending) return;
    dictation.cancel();
    speech.stop();
    unlockSpeech();

    const previous = messages;
    setMessages([...previous, { role: "user", content }]);
    setInput("");

    startSending(async () => {
      const result = await sendInterviewPrepMessageAction(previous, content, student, sessionId);
      if (result.success) {
        const startIndex = previous.length + 1;
        setMessages((prev) => [
          ...prev,
          ...result.replies.map((reply): Message => ({ role: "assistant", content: reply })),
        ]);
        // Lit à voix haute ce que dit le/la recruteur·se dans la réponse.
        if (speechEnabledRef.current) {
          result.replies.forEach((reply, k) => {
            const parts = splitCoachMessage(reply);
            if (parts.kind === "interview") speech.speak(parts.recruiter, `${startIndex + k}-recruiter`);
          });
        }
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
    // h-dvh : suit la hauteur réellement visible sur mobile (barre d'adresse,
    // clavier ouvert) pour que la zone de saisie reste toujours accessible.
    <div className="flex h-dvh flex-col">
      <AppHeader
        center={
          userTurns === 0
            ? "Simulation d'entretien"
            : `Simulation en cours · ${userTurns} réponse${userTurns > 1 ? "s" : ""}`
        }
        actions={
          <>
          {speech.supported && (
            <Button
              type="button"
              variant={speech.enabled ? "secondary" : "ghost"}
              size="sm"
              onClick={speech.toggleEnabled}
              aria-pressed={speech.enabled}
              title={speech.enabled ? "Couper la voix du recruteur" : "Activer la voix du recruteur"}
            >
              {speech.enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              <span className="hidden sm:inline">{speech.enabled ? "Voix activée" : "Voix coupée"}</span>
            </Button>
          )}
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
          </>
        }
      />

      {noticeVisible && (
        <div className="shrink-0 border-b border-border/60 bg-background px-3 py-2 sm:px-6">
          <div className="relative mx-auto w-full max-w-3xl pr-8">
            <UsageNotice compact />
            <button
              type="button"
              onClick={() => setNoticeVisible(false)}
              aria-label="Masquer les informations"
              className="absolute top-0 right-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8">
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
                    <div className="max-w-[88%] rounded-3xl bg-muted px-4 py-2.5 sm:max-w-[85%] sm:px-5 sm:py-3 text-[15px] leading-relaxed break-words whitespace-pre-line">
                      {message.content}
                    </div>
                  </div>
                );
              }

              const parts = splitCoachMessage(message.content);
              const noteReminder = showNoteReminder && (
                <p className="mt-2 text-xs font-medium text-destructive">⚠️ Pensez à prendre des notes !</p>
              );

              if (parts.kind === "interview") {
                return (
                  <div key={i} className="space-y-4">
                    {parts.feedback && (
                      <div className="flex gap-2.5 sm:gap-4">
                        <CoachAvatar />
                        <div className="min-w-0 flex-1">
                          <div className="rounded-2xl border border-border bg-accent/40 px-4 py-3 sm:px-5 sm:py-4">
                            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
                              <Lightbulb className="size-3.5" /> Retour du coach
                            </p>
                            <div className="text-[15px] leading-relaxed break-words whitespace-pre-line">{parts.feedback}</div>
                          </div>
                          <ListenButton speech={speech} text={parts.feedback} id={`${i}-feedback`} />
                          {noteReminder}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2.5 sm:gap-4">
                      <RecruiterAvatar />
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">Recruteur·se</p>
                        <div className="text-[15px] leading-relaxed break-words whitespace-pre-line">{parts.recruiter}</div>
                        <ListenButton speech={speech} text={parts.recruiter} id={`${i}-recruiter`} />
                        {!parts.feedback && noteReminder}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="flex gap-2.5 sm:gap-4">
                  <CoachAvatar />
                  <div className="min-w-0 flex-1 pt-1">
                    <div
                      className={cn(
                        "text-[15px] leading-relaxed break-words whitespace-pre-line",
                        isChecklistMessage && "rounded-2xl border border-border bg-accent/40 px-4 py-3 sm:px-5 sm:py-4"
                      )}
                    >
                      {parts.text}
                    </div>
                    <ListenButton speech={speech} text={parts.text} id={`${i}-text`} />
                    {noteReminder}
                  </div>
                </div>
              );
            });
          })()}

          {sending && (
            <div className="flex gap-2.5 sm:gap-4">
              <CoachAvatar />
              <div className="flex items-center gap-2 pt-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Le coach écrit...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 bg-background px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-3xl border border-border bg-card p-1.5 pl-4 shadow-soft sm:p-2 sm:pl-5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isTouchDevice()) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                dictation.listening
                  ? "Parlez, votre réponse s'écrit ici..."
                  : userTurns === 0
                    ? "Décrivez le poste visé (intitulé, entreprise, secteur)..."
                    : "Écrivez ou dictez votre réponse..."
              }
              rows={1}
              disabled={ending}
              aria-label="Votre message"
              className="max-h-[220px] flex-1 resize-none bg-transparent py-2 text-base leading-relaxed outline-none sm:text-[15px] placeholder:text-muted-foreground disabled:opacity-50"
            />
            {dictation.supported && (
              <Button
                type="button"
                size="icon"
                variant={dictation.listening ? "destructive" : "outline"}
                className={cn("size-9 shrink-0 rounded-full", dictation.listening && "animate-pulse")}
                // Garde le curseur dans la zone de réponse : Entrée envoie
                // toujours le message, même juste après un clic sur le micro.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Coupe la voix avant de dicter (sinon le micro l'entendrait).
                  if (!dictation.listening) speech.stop();
                  dictation.toggle();
                  inputRef.current?.focus();
                }}
                disabled={ending}
                aria-label={dictation.listening ? "Arrêter la dictée vocale" : "Dicter ma réponse"}
                title={dictation.listening ? "Arrêter la dictée vocale" : "Dicter ma réponse"}
              >
                {dictation.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
            )}
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
          {dictation.listening && (
            <p className="mt-1.5 text-center text-xs text-destructive sm:hidden">
              Dictée en cours : relisez puis appuyez sur la flèche pour envoyer.
            </p>
          )}
          <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
            {dictation.listening
              ? "Dictée en cours : relisez puis appuyez sur Entrée ou sur la flèche pour envoyer."
              : "Entrée pour envoyer · Maj + Entrée pour aller à la ligne · Micro pour dicter"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ListenButton({
  speech,
  text,
  id,
}: {
  speech: ReturnType<typeof useSpeech>;
  text: string;
  id: string;
}) {
  if (!speech.supported) return null;
  const playing = speech.speakingId === id;
  return (
    <button
      type="button"
      onClick={() => (playing ? speech.stop() : speech.speak(text, id))}
      className={cn(
        "mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
        playing && "text-primary"
      )}
    >
      {playing ? <Square className="size-3" /> : <Volume2 className="size-3.5" />}
      {playing ? "Arrêter la lecture" : "Écouter"}
    </button>
  );
}

function RecruiterAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8 bg-foreground text-background">
      <Briefcase className="size-3.5 sm:size-4" />
    </span>
  );
}

function CoachAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full sm:size-8 bg-primary text-primary-foreground">
      <Mic className="size-4" />
    </span>
  );
}
