"use server";

import { extractCvData, type CvExtraction } from "@/lib/ai/cv-analysis";
import { renderPdfFirstPageToPng } from "@/lib/pdf-preview";
import { incrementStats } from "@/lib/stats";

// Analyseur de CV — même principe que la prépa entretien : AUCUN stockage.
// Le PDF reçu est envoyé à l'IA, un aperçu de sa première page est rendu,
// et tout est renvoyé au navigateur puis oublié : ni fichier enregistré,
// ni base, ni contenu dans les logs. Seul un compteur anonyme
// (« une analyse de plus aujourd'hui ») alimente la page /stats.

// Limite de Vercel pour le corps d'une requête : 4,5 Mo.
const MAX_CV_BYTES = 4 * 1024 * 1024;

export type AnalyzeCvResult =
  | { success: true; extraction: CvExtraction; previewDataUrl: string | null }
  | { success: false; error: string };

export async function analyzeCvAction(formData: FormData): Promise<AnalyzeCvResult> {
  const file = formData.get("cv");
  const degree = String(formData.get("degree") ?? "").trim().slice(0, 120);
  const year = String(formData.get("year") ?? "").trim().slice(0, 40);

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Aucun fichier reçu." };
  }
  if (file.size > MAX_CV_BYTES) {
    return { success: false, error: "Fichier trop lourd (4 Mo maximum). Exportez votre CV en PDF plus léger." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Vérifie la signature d'un PDF (« %PDF ») plutôt que le seul type annoncé.
  if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") {
    return { success: false, error: "Ce fichier n'est pas un PDF. Exportez votre CV au format PDF." };
  }

  let extraction: CvExtraction | null;
  try {
    extraction = await extractCvData(bytes.toString("base64"), {
      registeredDegree: degree || null,
      registeredYear: year || null,
    });
  } catch (err) {
    console.error("[cv-analysis] échec de l'analyse :", err instanceof Error ? err.message : err);
    return { success: false, error: "L'analyse du CV a échoué. Réessayez dans quelques instants." };
  }

  if (!extraction) {
    return {
      success: false,
      error: "Le CV n'a pas pu être analysé (format non reconnu ou document illisible).",
    };
  }

  // Aperçu de la 1re page pour la comparaison avec le CV type (best-effort).
  let previewDataUrl: string | null = null;
  try {
    const png = await renderPdfFirstPageToPng(bytes, 2);
    previewDataUrl = `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    console.error("[cv-analysis] aperçu indisponible :", err instanceof Error ? err.message : err);
  }

  await incrementStats({ cv: 1 });

  return { success: true, extraction, previewDataUrl };
}
