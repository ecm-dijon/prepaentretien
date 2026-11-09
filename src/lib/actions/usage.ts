"use server";

import { incrementStats } from "@/lib/stats";

// Événements d'usage envoyés par la page (compteurs anonymes uniquement, voir
// src/lib/stats.ts). Les réponses envoyées au coach sont, elles, comptées
// côté serveur dans sendInterviewPrepMessageAction.

export async function recordSessionStartedAction(profileFilled: boolean) {
  await incrementStats({ started: 1, profile_filled: profileFilled ? 1 : 0 });
}

export async function recordSessionCompletedAction(answers: number, durationSec: number) {
  // Bornes de sécurité : 0-80 réponses, 0-4 h.
  const safeAnswers = Math.min(Math.max(Math.round(answers) || 0, 0), 80);
  const safeDuration = Math.min(Math.max(Math.round(durationSec) || 0, 0), 4 * 3600);
  await incrementStats({ completed: 1, completed_answers: safeAnswers, duration_sec: safeDuration });
}

export async function recordPdfDownloadedAction() {
  await incrementStats({ pdf: 1 });
}
