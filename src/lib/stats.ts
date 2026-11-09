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

// ---------------------------------------------------------------------------
// Sessions individuelles ANONYMES : une ligne par simulation, repérée par un
// identifiant aléatoire généré dans le navigateur au démarrage (jamais lié à
// une personne, ni stocké côté navigateur). On ne garde que des horodatages
// et des compteurs — jamais le contenu, le prénom ou le poste visé.
// Conservées 90 jours.
// ---------------------------------------------------------------------------

const SESSION_TTL_SEC = 90 * 24 * 3600;
const SESSIONS_INDEX = "prepa:sessions";
const sessionKey = (id: string) => `prepa:session:${id}`;
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && SESSION_ID_RE.test(id);
}

export type SessionRecord = {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  completedAt: number | null;
  answers: number;
  profileFilled: boolean;
  pdf: boolean;
};

async function safely(fn: (client: Redis) => Promise<unknown>) {
  const client = getRedis();
  if (!client) return;
  try {
    await fn(client);
  } catch (err) {
    console.error("[stats] session update failed:", err instanceof Error ? err.message : err);
  }
}

export async function recordSessionStart(id: string, profileFilled: boolean) {
  if (!isValidSessionId(id)) return;
  const now = Date.now();
  await safely(async (client) => {
    const key = sessionKey(id);
    // hsetnx : un identifiant déjà connu ne peut pas être « redémarré ».
    const created = await client.hsetnx(key, "started", now);
    if (!created) return;
    const p = client.pipeline();
    p.hset(key, { last: now, answers: 0, profile: profileFilled ? 1 : 0, completed: 0, pdf: 0 });
    p.expire(key, SESSION_TTL_SEC);
    p.zadd(SESSIONS_INDEX, { score: now, member: id });
    p.zremrangebyscore(SESSIONS_INDEX, 0, now - SESSION_TTL_SEC * 1000);
    await p.exec();
  });
}

// Mises à jour uniquement pour une session réellement démarrée.
async function updateSession(id: string, fn: (p: ReturnType<Redis["pipeline"]>, key: string) => void) {
  if (!isValidSessionId(id)) return;
  await safely(async (client) => {
    const key = sessionKey(id);
    if (!(await client.hexists(key, "started"))) return;
    const p = client.pipeline();
    fn(p, key);
    await p.exec();
  });
}

export async function recordSessionAnswer(id: string) {
  await updateSession(id, (p, key) => {
    p.hincrby(key, "answers", 1);
    p.hset(key, { last: Date.now() });
  });
}

export async function recordSessionCompleted(id: string) {
  const now = Date.now();
  await updateSession(id, (p, key) => {
    p.hsetnx(key, "completed_at", now);
    p.hset(key, { completed: 1, last: now });
  });
}

export async function recordSessionPdf(id: string) {
  await updateSession(id, (p, key) => {
    p.hset(key, { pdf: 1, last: Date.now() });
  });
}

export async function getRecentSessions(limit: number): Promise<SessionRecord[]> {
  const client = getRedis();
  if (!client) return [];
  const ids = (await client.zrange(SESSIONS_INDEX, 0, limit - 1, { rev: true })) as string[];
  if (!ids.length) return [];
  const p = client.pipeline();
  for (const id of ids) p.hgetall(sessionKey(id));
  const rows = (await p.exec()) as (Record<string, unknown> | null)[];

  const sessions: SessionRecord[] = [];
  ids.forEach((id, i) => {
    const row = rows[i];
    const startedAt = Number(row?.started);
    if (!row || !startedAt) return; // expirée
    const completedAt = Number(row.completed_at) || null;
    sessions.push({
      id,
      startedAt,
      lastActivityAt: Number(row.last) || startedAt,
      completedAt,
      answers: Number(row.answers) || 0,
      profileFilled: Number(row.profile) === 1,
      pdf: Number(row.pdf) === 1,
    });
  });
  return sessions;
}
