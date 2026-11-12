"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Dictée vocale via l'API Web Speech du navigateur (Chrome, Edge, Safari).
// Le texte reconnu est ajouté à la suite de ce qui est déjà saisi ; rien
// n'est stocké par l'application. Non disponible sur Firefox.

type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const joinText = (a: string, b: string) => (a && b ? `${a.replace(/\s+$/, "")} ${b.replace(/^\s+/, "")}` : a || b);

export function useDictation({
  getText,
  setText,
  onError,
}: {
  getText: () => string;
  setText: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const wantedRef = useRef(false); // l'utilisateur veut que la dictée continue
  const baseRef = useRef(""); // texte présent avant le début de la phrase en cours
  const finalRef = useRef(""); // texte dicté et validé depuis baseRef

  // Détection après le montage (évite un écart de rendu serveur / navigateur).
  useEffect(() => setSupported(getCtor() !== null), []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    baseRef.current = getText();
    finalRef.current = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current = joinText(finalRef.current, transcript.trim());
        else interim = joinText(interim, transcript.trim());
      }
      setText(joinText(joinText(baseRef.current, finalRef.current), interim));
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantedRef.current = false;
        onError("Accès au micro refusé : autorisez le micro pour ce site dans votre navigateur.");
      } else if (event.error === "audio-capture") {
        wantedRef.current = false;
        onError("Aucun micro détecté.");
      }
      // "no-speech" / "aborted" : on laisse onend relancer si besoin.
    };
    recognition.onend = () => {
      // Le navigateur coupe parfois la dictée après un silence : on relance
      // tant que l'utilisateur ne l'a pas arrêtée lui-même.
      if (wantedRef.current) {
        try {
          startRecognition();
          return;
        } catch {
          wantedRef.current = false;
        }
      }
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [getText, setText, onError]);

  const start = useCallback(() => {
    if (!getCtor() || wantedRef.current) return;
    wantedRef.current = true;
    setListening(true);
    try {
      startRecognition();
    } catch {
      wantedRef.current = false;
      setListening(false);
      onError("Impossible de démarrer la dictée vocale.");
    }
  }, [startRecognition, onError]);

  useEffect(
    () => () => {
      wantedRef.current = false;
      recognitionRef.current?.abort();
    },
    []
  );

  return { supported, listening, start, stop, toggle: listening ? stop : start };
}
