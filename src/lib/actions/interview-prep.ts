"use server";

import { z } from "zod";

import {
  getInterviewPrepReply,
  summarizeInterviewPrepSession,
  type ChatTurn,
  type InterviewPrepSummary,
} from "@/lib/ai/interview-prep";
import { PRE_INTERVIEW_CHECKLIST_MESSAGE } from "@/lib/ai/interview-prep-checklist";
import { incrementStats, recordSessionAnswer } from "@/lib/stats";

// Aucune base, aucun compte : toute la session (profil + messages) vit
// uniquement dans la mémoire de la page côté navigateur. Ces actions sont
// sans état — elles reçoivent l'historique complet à chaque appel, le
// transmettent à l'API Claude et ne conservent rien (ni log du contenu).

const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 4000;

const historySchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
    })
  )
  .max(MAX_MESSAGES + 2);

const profileSchema = z.object({
  firstName: z.string().trim().max(80),
  headline: z.string().trim().max(200),
  degree: z.string().trim().max(120),
  currentYear: z.string().trim().max(40),
  skills: z.array(z.string().trim().min(1).max(80)).max(40),
  experiences: z.array(z.string().trim().min(1).max(200)).max(20),
});

export type StudentContext = z.infer<typeof profileSchema>;

export type SendMessageResult = { success: true; replies: string[] } | { success: false; error: string };

export async function sendInterviewPrepMessageAction(
  previousMessages: ChatTurn[],
  userMessage: string,
  student: StudentContext,
  // Identifiant aléatoire et anonyme de la simulation (statistiques uniquement).
  sessionId?: string
): Promise<SendMessageResult> {
  const trimmed = userMessage.trim();
  if (!trimmed) return { success: false, error: "Message vide." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) return { success: false, error: "Message trop long." };

  const parsedHistory = historySchema.safeParse(previousMessages);
  const parsedStudent = profileSchema.safeParse(student);
  if (!parsedHistory.success || !parsedStudent.success) {
    return { success: false, error: "Session invalide. Rechargez la page pour recommencer." };
  }

  // Cost/abuse guard (repris de la plateforme) : borne la durée d'une
  // session. Pour aller plus loin, l'étudiant·e en démarre une nouvelle.
  if (parsedHistory.data.length >= MAX_MESSAGES) {
    return {
      success: false,
      error: "Cette session est bien fournie ! Terminez-la et relancez-en une nouvelle si besoin.",
    };
  }

  // Seul le message d'ouverture précède : ce message-ci est la toute
  // première réponse (poste visé). Les rappels avant-entretien s'insèrent
  // juste après elle, avant la vraie première question du coach.
  const isFirstStudentReply = parsedHistory.data.length <= 1;

  const history: ChatTurn[] = [...parsedHistory.data, { role: "user", content: trimmed }];
  const s = parsedStudent.data;

  let reply: string;
  try {
    reply = await getInterviewPrepReply(history, {
      firstName: s.firstName,
      headline: s.headline || null,
      skills: s.skills,
      experiences: s.experiences,
      degree: s.degree || null,
      currentYear: s.currentYear || null,
    });
  } catch (err) {
    console.error("[interview-prep] getInterviewPrepReply failed:", err instanceof Error ? err.message : err);
    return { success: false, error: "Le coach n'a pas pu répondre pour le moment. Réessayez." };
  }

  // Compteurs anonymes (aucun contenu) : une réponse de plus, et une
  // simulation « engagée » dès la première réponse.
  await Promise.all([
    incrementStats({ answers: 1, engaged: isFirstStudentReply ? 1 : 0 }),
    sessionId ? recordSessionAnswer(sessionId) : Promise.resolve(),
  ]);

  const replies: string[] = [];
  if (isFirstStudentReply) replies.push(PRE_INTERVIEW_CHECKLIST_MESSAGE);
  replies.push(reply);

  return { success: true, replies };
}

export type SummaryResult =
  | { success: true; summary: InterviewPrepSummary }
  | { success: false; error: string };

export async function summarizeInterviewPrepAction(messages: ChatTurn[]): Promise<SummaryResult> {
  const parsed = historySchema.safeParse(messages);
  if (!parsed.success || !parsed.data.some((m) => m.role === "user")) {
    return { success: false, error: "Rien à résumer pour cette session." };
  }

  try {
    const summary = await summarizeInterviewPrepSession(parsed.data);
    if (summary) return { success: true, summary };
  } catch (err) {
    console.error(
      "[interview-prep] summarizeInterviewPrepSession failed:",
      err instanceof Error ? err.message : err
    );
  }
  return { success: false, error: "Le compte rendu n'a pas pu être généré. Réessayez." };
}
