import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/ai/client";
import { REFERENCE_CV_TEMPLATE_BASE64 } from "@/lib/ai/assets/reference-cv-template-base64";
import { sanitizeAiText, sanitizeAiTextArray } from "@/lib/ai/sanitize-text";

const extractedSkillSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["technique", "humaine", "metier", "linguistique", "numerique"]),
  level: z.enum(["debutant", "intermediaire", "avance", "expert"]),
});

const extractedExperienceSchema = z.object({
  title: z.string().min(1),
  organization: z.string().min(1),
  experience_type: z.enum(["stage", "alternance", "emploi", "associatif", "benevolat"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().optional(),
});

const extractedCertificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().min(1),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const cvExtractionSchema = z.object({
  headline: z.string().optional(),
  bio: z.string().optional(),
  geographic_mobility: z.string().optional(),
  availability_types: z.array(z.string()).optional(),
  softwares: z.array(z.string()).optional(),
  skills: z.array(extractedSkillSchema).optional(),
  experiences: z.array(extractedExperienceSchema).optional(),
  certifications: z.array(extractedCertificationSchema).optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  has_driving_license: z.boolean().optional(),
});

export type CvExtraction = z.infer<typeof cvExtractionSchema>;

const CV_EXTRACTION_TOOL = {
  name: "record_cv_data",
  description:
    "Enregistre les informations structurées extraites du CV via l'outil fourni. N'invente rien : omets un champ si l'information n'apparaît pas clairement dans le document. Pour une expérience dont la date de début n'est pas précise, utilise le 1er du mois si seul le mois/année est connu ; si même l'année est inconnue, omets cette expérience du tableau `experiences`.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: {
        type: "string",
        description: "Titre professionnel affiché en haut du CV, s'il y en a un.",
      },
      bio: {
        type: "string",
        description: "Synthèse/accroche de présentation du CV, à la première personne, si présente.",
      },
      geographic_mobility: {
        type: "string",
        description:
          "Zone de mobilité géographique si indiquée (ex : \"Dijon, Chalon\", \"France entière\"), souvent dans un bloc \"Informations\" ou \"Mobilité\".",
      },
      availability_types: {
        type: "array",
        items: { type: "string" },
        description:
          "Types de contrat recherchés d'après l'accroche du CV (ex : \"À la recherche d'un stage de 3 mois...\"), ex : [\"Stage\"] ou [\"Alternance\"]. Seul le type compte, pas la durée.",
      },
      softwares: { type: "array", items: { type: "string" }, description: "Logiciels/outils cités." },
      skills: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: {
              type: "string",
              enum: ["technique", "humaine", "metier", "linguistique", "numerique"],
            },
            level: {
              type: "string",
              enum: ["debutant", "intermediaire", "avance", "expert"],
              description: "Meilleure estimation d'après le CV (mise en avant, contexte, années d'expérience).",
            },
          },
          required: ["name", "category", "level"],
        },
      },
      experiences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            organization: { type: "string" },
            experience_type: {
              type: "string",
              enum: ["stage", "alternance", "emploi", "associatif", "benevolat"],
            },
            start_date: { type: "string", description: "Format YYYY-MM-DD." },
            end_date: { type: "string", description: "Format YYYY-MM-DD, absent si en cours." },
            description: { type: "string" },
          },
          required: ["title", "organization", "experience_type", "start_date"],
        },
      },
      certifications: {
        type: "array",
        description:
          "Diplômes ET certifications — à extraire SYSTÉMATIQUEMENT depuis la section \"Formations\"/\"Diplômes\"/\"Parcours scolaire\" du CV (Baccalauréat, BTS, Licence, Bachelor, Master, titre professionnel, etc.), en plus de toute certification professionnelle mentionnée ailleurs (TOEIC, certification logicielle, permis de former...). Ne saute jamais la section Formations : c'est la source la plus fréquente et la plus importante de ce tableau, quasiment tout CV en contient au moins une ligne.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Intitulé exact du diplôme ou de la certification (ex: \"Licence Commerce Vente Marketing\", \"Baccalauréat série générale\", \"TOEIC\").",
            },
            issuer: {
              type: "string",
              description: "Établissement ou organisme (ex: \"École de Commerce et de Management\", \"ETS Global\").",
            },
            issue_date: {
              type: "string",
              description: "Format YYYY-MM-DD. Pour un diplôme scolaire, utilise la fin de la période indiquée (ex: \"2023-2025\" -> 2025-01-01) si aucune date précise d'obtention n'est donnée ; omets si vraiment aucune indication temporelle n'existe.",
            },
          },
          required: ["name", "issuer"],
        },
      },
      date_of_birth: {
        type: "string",
        description: "Date de naissance si indiquée sur le CV (souvent dans le bloc \"Informations\"), format YYYY-MM-DD.",
      },
      has_driving_license: {
        type: "boolean",
        description: "true si le CV mentionne le permis B (ou \"permis de conduire\") comme obtenu, absent si non mentionné.",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Avis sur le CV (repris de la Plateforme des Compétences). Appel séparé de
// l'extraction, lancé
// en parallèle : chacun fait moitié moins de travail, l'attente totale est
// divisée d'autant.
// ---------------------------------------------------------------------------

export const cvReviewSchema = z.object({
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  profile_mismatch: z.string().optional(),
});

export type CvReview = {
  strengths: string[];
  improvements: string[];
  profile_mismatch: string | null;
};

const CV_REVIEW_TOOL = {
  name: "record_cv_review",
  description:
    "Enregistre l'avis sur la qualité et la conformité du CV par rapport au gabarit CV type de l'ECM. Rédigé EXCLUSIVEMENT en français, sans aucun mot dans une autre langue.",
  input_schema: {
    type: "object" as const,
    properties: {
      strengths: {
        type: "array",
        items: { type: "string" },
        description:
          "2 à 5 points forts concrets du CV (présentation, structure, mise en avant de compétences ou d'expériences pertinentes...).",
      },
      improvements: {
        type: "array",
        description:
          "2 à 7 points à améliorer, en couvrant systématiquement (quand pertinent) : (1) le titre/accroche — doit être \"Recherche d'alternance dans le cadre du [diplôme]\" ou \"Recherche de stage dans le cadre du [diplôme]\", bien visible sous le nom, jamais absent ou noyé ; propose la formulation exacte si elle manque ou est mal positionnée ; (2) la photo si présente — visage net et bien visible, cadrage et éclairage corrects, tenue/contexte neutres ; dis-le clairement si elle est floue, sombre, trop éloignée, ou visiblement une photo de loisir ; (3) toute incohérence entre le projet visé (accroche/titre) et les compétences ou logiciels listés (ex : vise la communication mais ne cite aucun logiciel de création) ; (4) sections manquantes/incomplètes par rapport au gabarit ECM, qualité générale (formulations, fautes, expériences mal valorisées). Pour CHAQUE point, explique en une phrase pourquoi ça compte concrètement pour la recherche de stage/alternance (impact pour un recruteur qui lit le CV en quelques secondes) — n'invoque jamais \"c'est attendu dans le gabarit de l'école\" comme seule justification, la vraie raison est toujours pratique/métier. Phrases courtes, concrètes, bienveillantes, adressées directement à l'étudiant·e en le/la VOUVOYANT (jamais de tutoiement).",
        items: { type: "string" },
      },
      profile_mismatch: {
        type: "string",
        description:
          "Rempli UNIQUEMENT si ce CV semble correspondre à un autre diplôme/cursus que celui indiqué par l'étudiant·e (voir contexte fourni dans le message utilisateur) — phrase claire adressée à l'étudiant·e (vouvoiement) expliquant l'écart et lui demandant de vérifier qu'il s'agit de la bonne version de son CV. Absent si aucun décalage net de ce type.",
      },
    },
  },
};

// Prépa entretien : aucun profil enregistré — le seul contexte possible est
// le diplôme et l'année que l'étudiant·e choisit (facultativement) avant
// l'analyse, pour garder la vérification « ce CV correspond-il bien à mon
// diplôme ? » de la Plateforme des Compétences.
export type CvKnownProfileContext = {
  registeredDegree?: string | null;
  registeredYear?: string | null;
};

function buildKnownProfileContextText(context?: CvKnownProfileContext): string | null {
  if (!context?.registeredDegree) return null;
  return (
    "Diplôme préparé indiqué par l'étudiant·e avant l'envoi de ce CV : \"" +
    context.registeredDegree +
    "\"" +
    (context.registeredYear ? ` (${context.registeredYear})` : "") +
    ".\n\nCompare SYSTÉMATIQUEMENT ce CV à ce diplôme — c'est la vérification la plus importante. Si le " +
    "titre/l'accroche du CV mentionne un diplôme, un cursus ou un métier visé clairement différent (ex : " +
    "\"Parcours Business\" 1ère année indiqué mais le CV est rédigé pour un \"Master Management " +
    "événementiel\"), ou si les expériences/le projet du CV ne correspondent manifestement pas à ce niveau " +
    "d'études, REMPLIS le champ `profile_mismatch` avec une phrase claire décrivant l'écart précis constaté " +
    "et demandant de vérifier que c'est bien la bonne version du CV. Ne le remplis que si l'écart est réel " +
    "et net, jamais pour de simples reformulations ou une simple évolution de projet professionnel."
  );
}

const LANGUAGE_RULES =
  "IMPORTANT — Rédige TOUJOURS en français, sans aucune exception, tout le texte que tu génères toi-même : jamais un mot ni une phrase dans une autre langue, quelle qu'elle soit. Seules les données recopiées telles quelles depuis le CV (noms propres, intitulés de poste ou de diplôme, noms d'entreprise) peuvent rester dans leur langue d'origine si le CV lui-même les contient ainsi. N'utilise jamais de mise en forme Markdown (pas d'astérisques **, de dièses #...) : texte brut uniquement, l'interface ne l'affiche pas en gras/italique.\n\n";

const TEMPLATE_DESCRIPTION =
  "Si un CV de référence ECM t'est fourni en premier document (avant le CV à analyser), utilise-le comme repère structurel — c'est un gabarit bien construit : bloc \"Informations\" à gauche (contact, mobilité, âge, permis), \"Compétences\", \"Logiciels\", \"Langues\", \"Centres d'intérêt\" (à ignorer, non stocké), une photo, et à droite un titre du type \"Recherche d'alternance dans le cadre de ma [diplôme]\" ou \"Recherche d'un stage ... dans le cadre de ma [diplôme]\" juste sous le nom, une courte accroche, \"Expériences professionnelles\", \"Formations\". Le CV réel à analyser peut différer de ce gabarit — adapte-toi au document effectivement fourni, ne pénalise pas une mise en page différente en soi, seulement les vrais manques de fond.\n\n";

// Appel d'outil non forcé ("auto" : forcer l'outil est incompatible avec la
// réflexion du modèle, activée par défaut), délai strict sans relances
// automatiques du SDK, une relance si le modèle n'a pas appelé l'outil et
// qu'il reste du temps. Vercel coupe la fonction à 60 s.
async function callTool(
  request: Anthropic.MessageCreateParamsNonStreaming,
  toolName: string,
  startedAt: number
): Promise<unknown> {
  const client = getAnthropicClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    const elapsed = Date.now() - startedAt;
    if (attempt > 0 && elapsed > 20_000) break;
    const message = await client.messages.create(request, { timeout: 52_000 - elapsed, maxRetries: 0 });
    const toolUse = message.content.find((block) => block.type === "tool_use" && block.name === toolName);
    if (toolUse && toolUse.type === "tool_use") return toolUse.input;
    console.error(`[cv-analysis] ${toolName} non appelé. stop_reason:`, message.stop_reason);
  }
  return null;
}

// Extraction des informations du CV (accroche, expériences, formations...).
export async function extractCvData(pdfBase64: string, startedAt = Date.now()): Promise<CvExtraction | null> {
  const input = await callTool(
    {
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      // Lecture / extraction : peu de réflexion nécessaire, et bien plus rapide.
      output_config: { effort: "low" },
      system:
        LANGUAGE_RULES +
        "Tu analyses le CV (PDF) d'un·e étudiant·e de l'ECM (école de commerce et management) et tu en extrais des données structurées via l'outil fourni.\n\n" +
        "N'oublie jamais de remplir `certifications` à partir de la section \"Formations\" du CV (Bac, Licence, Bachelor, Master, titre professionnel...) — voir la description détaillée de ce champ dans l'outil. Chaque diplôme listé dans cette section doit devenir une entrée, même sans certification professionnelle au sens strict.\n\n" +
        "Reste factuel, n'extrais que ce que tu observes réellement dans le document. Tu DOIS appeler l'outil record_cv_data, une seule fois : c'est ta seule façon de répondre.",
      tools: [CV_EXTRACTION_TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: "Voici le CV à analyser." },
          ],
        },
      ],
    },
    "record_cv_data",
    startedAt
  );
  if (input === null) return null;

  const parsed = cvExtractionSchema.safeParse(input);
  if (!parsed.success) {
    // Jamais le contenu du CV dans les logs : rien n'est conservé.
    console.error(
      "[cv-analysis] données extraites invalides, champs :",
      Object.keys(parsed.error.flatten().fieldErrors).join(", ")
    );
    return null;
  }
  return {
    ...parsed.data,
    headline: sanitizeAiText(parsed.data.headline),
    bio: sanitizeAiText(parsed.data.bio),
  };
}

// Avis sur le CV, comparé au CV type ECM (même consignes que la plateforme).
export async function reviewCv(
  pdfBase64: string,
  context?: CvKnownProfileContext,
  startedAt = Date.now()
): Promise<CvReview | null> {
  const contextText = buildKnownProfileContextText(context);

  const input = await callTool(
    {
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      output_config: { effort: "low" },
      system:
        LANGUAGE_RULES +
        "Tu donnes ton avis sur le CV d'un·e étudiant·e de l'ECM (école de commerce et management) via l'outil fourni.\n\n" +
        TEMPLATE_DESCRIPTION +
        "Remplis `strengths` et `improvements` (voir la description détaillée du champ `improvements` dans l'outil pour ce qu'il faut systématiquement vérifier : titre/accroche au bon format, qualité de la photo, cohérence entre projet visé et compétences/logiciels, sections manquantes). Le gabarit ECM est une grille de lecture interne — jamais la raison donnée à l'étudiant·e : pour chaque point d'amélioration, explique la vraie raison pratique (impact pour un recruteur, pour décrocher un entretien), jamais \"parce que c'est attendu par l'école\". " +
        "Si un contexte sur la formation de l'étudiant·e t'est fourni dans le message utilisateur, compare-le au CV et signale toute incohérence nette. Reste factuel, ne juge que ce que tu observes réellement dans le document. Tu DOIS appeler l'outil record_cv_review, une seule fois : c'est ta seule façon de répondre.",
      tools: [CV_REVIEW_TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: REFERENCE_CV_TEMPLATE_BASE64 },
            },
            {
              type: "text",
              text: "Ceci est le CV de référence de l'ECM (gabarit bien structuré) — sers-t'en UNIQUEMENT pour comparer la structure et la formulation du CV suivant. Ce n'est pas le document à analyser.",
            },
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: "Voici le CV à analyser (celui-ci, pas le gabarit de référence)." },
            ...(contextText ? [{ type: "text" as const, text: contextText }] : []),
          ],
        },
      ],
    },
    "record_cv_review",
    startedAt
  );
  if (input === null) return null;

  const parsed = cvReviewSchema.safeParse(input);
  if (!parsed.success) {
    console.error(
      "[cv-analysis] avis invalide, champs :",
      Object.keys(parsed.error.flatten().fieldErrors).join(", ")
    );
    return null;
  }
  return {
    strengths: sanitizeAiTextArray(parsed.data.strengths) ?? [],
    improvements: sanitizeAiTextArray(parsed.data.improvements) ?? [],
    profile_mismatch: sanitizeAiText(parsed.data.profile_mismatch) || null,
  };
}
