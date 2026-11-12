"use client";

import { Mic, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function useDictationSupported() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);
  return supported;
}

// Bandeaux affichés en haut de l'écran de départ et du chat : conseil
// « dictée vocale » (en rouge) et rappel « rien n'est enregistré, pensez à
// télécharger le PDF ».
export function UsageNotice({ compact = false }: { compact?: boolean }) {
  const supported = useDictationSupported();

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <p
        className={cn(
          "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 font-medium text-destructive",
          compact ? "px-3 py-1.5 text-xs sm:text-sm" : "px-4 py-3 text-sm"
        )}
      >
        <Mic className="mt-0.5 size-4 shrink-0" />
        <span>
          {compact
            ? "Pour une meilleure utilisation, utilisez la dictée vocale (bouton micro en bas)."
            : "Pour une meilleure utilisation, utilisez la dictée vocale : cliquez sur le bouton micro à côté de la zone de réponse et parlez comme en vrai entretien."}
          {supported === false &&
            " (Non disponible sur ce navigateur : utilisez Chrome, Edge ou Safari, ou le micro du clavier de votre téléphone.)"}
        </span>
      </p>
      <p
        className={cn(
          "flex items-start gap-2 rounded-lg border border-border bg-muted/60 text-foreground",
          compact ? "px-3 py-1.5 text-xs sm:text-sm" : "px-4 py-3 text-sm"
        )}
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ecm-orange" />
        {compact ? (
          <span>
            Rien n&apos;est enregistré : à la fin, cliquez sur <strong>« Terminer la session »</strong> puis
            téléchargez le PDF, sinon il sera supprimé.
          </span>
        ) : (
        <span>
          Aucune donnée n&apos;est enregistrée. À la fin, cliquez sur <strong>« Terminer la session »</strong>{" "}
          pour accéder à votre compte rendu, puis <strong>téléchargez le PDF</strong> : si vous ne le
          téléchargez pas, il sera définitivement supprimé.
        </span>
        )}
      </p>
    </div>
  );
}
