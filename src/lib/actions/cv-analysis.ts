"use server";

import { extractCvData, reviewCv, type CvExtraction, type CvReview } from "@/lib/ai/cv-analysis";
import { renderPdfFirstPageToPng } from "@/lib/pdf-preview";
import { recordCvAnalysis } from "@/lib/stats";

// Analyseur de CV — même principe que la prépa entretien : AUCUN stockage.
// Le PDF reçu est envoyé à l'IA, un aperçu de sa première page est rendu,
// et tout est renvoyé au navigateur puis oublié : ni fichier enregistré,
// ni base, ni contenu dans les logs. Seul un compteur anonyme
// (« une analyse de plus aujourd'hui ») alimente la page /stats.

// Limite de Vercel pour le corps d'une requête : 4,5 Mo.
const MAX_CV_BYTES = 4 * 1024 * 1024;

export type AnalyzeCvResult =
  | {
      success: true;
      extraction: CvExtraction | null;
      review: CvReview | null;
      previewDataUrl: string | null;
      /** Identifiant anonyme de l'analyse (statistiques uniquement), ou null. */
      analysisId: string | null;
    }
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

  const startedAt = Date.now();
  const pdfBase64 = bytes.toString("base64");

  // Image de la 1re page, pour l'afficher à côté du CV type (best-effort).
  let pngBase64: string | null = null;
  try {
    pngBase64 = (await renderPdfFirstPageToPng(bytes, 2)).toString("base64");
  } catch (err) {
    console.error("[cv-analysis] aperçu indisponible :", err instanceof Error ? err.message : err);
  }

  // Les deux analyses tournent en parallèle (attente divisée par deux) ; si
  // l'une échoue, l'autre est quand même affichée.
  const [extractionResult, reviewResult] = await Promise.allSettled([
    extractCvData(pdfBase64, startedAt),
    reviewCv(
      pdfBase64,
      { registeredDegree: degree || null, registeredYear: year || null },
      startedAt
    ),
  ]);
  for (const r of [extractionResult, reviewResult]) {
    if (r.status === "rejected") {
      console.error("[cv-analysis] échec :", r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }
  const extraction = extractionResult.status === "fulfilled" ? extractionResult.value : null;
  const review = reviewResult.status === "fulfilled" ? reviewResult.value : null;

  const durationMs = Date.now() - startedAt;

  if (!extraction && !review) {
    await recordCvAnalysis({ durationMs, status: "failed", degreeGiven: Boolean(degree), mismatch: false, improvements: 0 });
    return {
      success: false,
      error: "L'analyse du CV n'a pas abouti. Réessayez dans quelques instants.",
    };
  }

  const previewDataUrl = pngBase64 ? `data:image/png;base64,${pngBase64}` : null;

  const analysisId = await recordCvAnalysis({
    durationMs,
    status: extraction && review ? "ok" : "partial",
    degreeGiven: Boolean(degree),
    mismatch: Boolean(review?.profile_mismatch),
    improvements: review?.improvements.length ?? 0,
  });

  return { success: true, extraction, review, previewDataUrl, analysisId };
}
