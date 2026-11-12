"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Lecture à voix haute via la synthèse vocale du navigateur (speechSynthesis) :
// gratuite, sans service externe ajouté par l'application, rien n'est stocké.
// La qualité de la voix dépend de l'appareil (très bonne sur Mac/iPhone,
// Edge et Chrome ; plus robotique sur certains Android/Windows anciens).

// Voix françaises les plus naturelles en premier (noms usuels selon les
// systèmes : macOS/iOS, Edge « Natural », Chrome « Google »).
const PREFERRED_VOICES = [/natural/i, /premium|enhanced|amélioré/i, /google/i, /amélie|audrey|thomas|marie|denise|henri|vivienne|remy/i];

function pickVoice(voices: SpeechSynthesisVoice[]) {
  const french = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  const frFR = french.filter((v) => v.lang.toLowerCase().replace("_", "-") === "fr-fr");
  const pool = frFR.length ? frFR : french;
  for (const re of PREFERRED_VOICES) {
    const match = pool.find((v) => re.test(v.name));
    if (match) return match;
  }
  return pool[0] ?? null;
}

// Découpe en phrases : Chrome coupe les lectures trop longues d'un seul bloc.
function splitSentences(text: string) {
  return (
    text
      .replace(/\s+/g, " ")
      .match(/[^.!?…]+[.!?…]*\s*/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

// iOS / Safari n'autorisent la synthèse vocale qu'après une action de
// l'utilisateur : appelé lors d'un clic (démarrer, envoyer) pour la débloquer.
export function unlockSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

export function useSpeech() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const ok = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setSupported(ok);
    if (!ok) return;
    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    tokenRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  // id : identifie ce qui est lu (pour afficher « en lecture » sur le bon bouton).
  const speak = useCallback((text: string, id: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const token = ++tokenRef.current;
    const sentences = splitSentences(text);
    if (!sentences.length) return;
    if (!voiceRef.current) voiceRef.current = pickVoice(synth.getVoices());
    setSpeakingId(id);
    sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = "fr-FR";
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 1;
      if (i === sentences.length - 1) {
        u.onend = () => {
          if (tokenRef.current === token) setSpeakingId(null);
        };
      }
      u.onerror = () => {
        if (tokenRef.current === token) setSpeakingId(null);
      };
      synth.speak(u);
    });
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((v) => {
      if (v) stop();
      return !v;
    });
  }, [stop]);

  return { supported, enabled, toggleEnabled, speakingId, speak, stop };
}
