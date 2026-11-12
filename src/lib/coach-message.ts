// Pendant l'entretien, chaque message de l'IA contient d'abord le retour du
// coach, puis le marqueur [RECRUTEUR], puis les paroles du/de la recruteur·se
// (voir le prompt système). Ce module découpe ces messages pour les afficher
// séparément, et les remet en texte lisible (transcription, PDF, compte rendu).

export const RECRUITER_MARKER = "[RECRUTEUR]";

export type CoachMessageParts =
  | { kind: "plain"; text: string }
  | { kind: "interview"; feedback: string; recruiter: string };

export function splitCoachMessage(content: string): CoachMessageParts {
  const index = content.indexOf(RECRUITER_MARKER);
  if (index === -1) return { kind: "plain", text: content };
  const feedback = content.slice(0, index).trim();
  const recruiter = content
    .slice(index + RECRUITER_MARKER.length)
    .split(RECRUITER_MARKER)
    .join("")
    .trim();
  if (!recruiter) return { kind: "plain", text: feedback };
  return { kind: "interview", feedback, recruiter };
}

// Version texte pour la transcription : « Retour du coach : … » puis
// « Recruteur : … ».
export function coachMessageToText(content: string): string {
  const parts = splitCoachMessage(content);
  if (parts.kind === "plain") return parts.text;
  return [parts.feedback && `Retour du coach : ${parts.feedback}`, `Recruteur : ${parts.recruiter}`]
    .filter(Boolean)
    .join("\n\n");
}
