import "server-only";

import { Redis } from "@upstash/redis";

// Statistiques d'usage ANONYMES : uniquement des compteurs agrégés par jour
// (aucun contenu de session, aucun identifiant, aucune adresse IP, aucun
// cookie). Stockées dans un Redis Upstash (créé depuis Vercel > Storage).
// Si Redis n'est pas configuré, tout est simplement ignoré : l'application
// fonctionne exactement pareil, sans statistiques.

export const STAT_FIELDS = [
  "started", // simulations démarrées
  "profile_filled", // dont formulaire de départ au moins partiellement rempli
  "engaged", // simulations où l'étudiant·e a répondu au moins une fois
  "answers", // réponses envoyées au coach
  "completed", // simulations terminées (« Terminer la session »)
  "completed_answers", // total des réponses des simulations terminées
  "duration_sec", // durée cumulée des simulations terminées (secondes)
  "pdf", // comptes rendus PDF téléchargés
] as const;

export type StatField = (typeof STAT_FIELDS)[number];
export type DayStats = { date: string } & Record<StatField, number>;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  // Noms posés par l'intégration Upstash de Vercel (KV_*) ou par Upstash directement.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function isStatsConfigured() {
  return getRedis() !== null;
}

// Jour calendaire en heure de Paris (AAAA-MM-JJ).
function parisDay(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

const keyFor = (day: string) => `prepa:stats:${day}`;

export async function incrementStats(increments: Partial<Record<StatField, number>>) {
  const client = getRedis();
  if (!client) return;
  const entries = Object.entries(increments).filter(([, v]) => v && v > 0) as [StatField, number][];
  if (!entries.length) return;
  try {
    const pipeline = client.pipeline();
    const key = keyFor(parisDay(new Date()));
    for (const [field, value] of entries) pipeline.hincrby(key, field, Math.round(value));
    await pipeline.exec();
  } catch (err) {
    // Jamais bloquant pour l'étudiant·e.
    console.error("[stats] increment failed:", err instanceof Error ? err.message : err);
  }
}

export async function getDailyStats(days: number): Promise<DayStats[]> {
  const client = getRedis();
  if (!client) return [];

  const dates: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) dates.push(parisDay(new Date(now - i * 86_400_000)));
  const unique = Array.from(new Set(dates));

  const pipeline = client.pipeline();
  for (const day of unique) pipeline.hgetall(keyFor(day));
  const rows = (await pipeline.exec()) as (Record<string, unknown> | null)[];

  return unique.map((date, i) => {
    const row = rows[i] ?? {};
    const stats = { date } as DayStats;
    for (const field of STAT_FIELDS) stats[field] = Number(row[field] ?? 0) || 0;
    return stats;
  });
}
