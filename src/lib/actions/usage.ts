"use server";

import {
  incrementStats,
  isValidSessionId,
  recordSessionCompleted,
  recordSessionPdf,
  recordSessionStart,
} from "@/lib/stats";

// Événements d'usage envoyés par la page (statistiques anonymes uniquement,
// voir src/lib/stats.ts). Les réponses envoyées au coach sont, elles,
// comptées côté serveur dans sendInterviewPrepMessageAction.

export async function recordSessionStartedAction(sessionId: string, profileFilled: boolean) {
  if (!isValidSessionId(sessionId)) return;
  await Promise.all([
    incrementStats({ started: 1, profile_filled: profileFilled ? 1 : 0 }),
    recordSessionStart(sessionId, profileFilled),
  ]);
}

export async function recordSessionCompletedAction(sessionId: string, answers: number, durationSec: number) {
  if (!isValidSessionId(sessionId)) return;
  // Bornes de sécurité : 0-80 réponses, 0-4 h.
  const safeAnswers = Math.min(Math.max(Math.round(answers) || 0, 0), 80);
  const safeDuration = Math.min(Math.max(Math.round(durationSec) || 0, 0), 4 * 3600);
  await Promise.all([
    incrementStats({ completed: 1, completed_answers: safeAnswers, duration_sec: safeDuration }),
    recordSessionCompleted(sessionId),
  ]);
}

export async function recordPdfDownloadedAction(sessionId: string) {
  if (!isValidSessionId(sessionId)) return;
  await Promise.all([incrementStats({ pdf: 1 }), recordSessionPdf(sessionId)]);
}
