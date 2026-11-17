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
  "cv", // CV analysés avec un résultat (complet ou partiel)
  "cv_failed", // analyses de CV sans aucun résultat (IA en échec ou trop lente)
  "cv_partial", // analyses où l'avis OU la lecture des informations a manqué
  "cv_degree", // analyses où l'étudiant·e a indiqué son diplôme
  "cv_mismatch", // analyses où un écart CV / diplôme a été signalé
  "cv_duration_sec", // temps d'analyse cumulé des analyses avec résultat (secondes)
  "cv_to_interview", // analyses suivies d'un clic « Préparer un entretien avec ce CV »
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

// ---------------------------------------------------------------------------
// Analyses de CV individuelles ANONYMES : une ligne par analyse, repérée par
// un identifiant aléatoire. Uniquement des horodatages, durées et indicateurs
// (jamais le CV, son contenu, un nom ou le diplôme lui-même). Conservées
// 90 jours.
// ---------------------------------------------------------------------------

const CV_RUNS_INDEX = "prepa:cvruns";
const cvRunKey = (id: string) => `prepa:cvrun:${id}`;

export type CvRunStatus = "ok" | "partial" | "failed";

export type CvRunRecord = {
  id: string;
  at: number;
  durationMs: number;
  status: CvRunStatus;
  degreeGiven: boolean;
  mismatch: boolean;
  improvements: number;
  toInterview: boolean;
};

export async function recordCvAnalysis(run: {
  durationMs: number;
  status: CvRunStatus;
  degreeGiven: boolean;
  mismatch: boolean;
  improvements: number;
}): Promise<string | null> {
  const durationSec = Math.round(run.durationMs / 1000);
  await incrementStats(
    run.status === "failed"
      ? { cv_failed: 1 }
      : {
          cv: 1,
          cv_partial: run.status === "partial" ? 1 : 0,
          cv_degree: run.degreeGiven ? 1 : 0,
          cv_mismatch: run.mismatch ? 1 : 0,
          cv_duration_sec: durationSec,
        }
  );

  const client = getRedis();
  if (!client) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    const p = client.pipeline();
    const key = cvRunKey(id);
    p.hset(key, {
      at: now,
      duration_ms: Math.round(run.durationMs),
      status: run.status,
      degree: run.degreeGiven ? 1 : 0,
      mismatch: run.mismatch ? 1 : 0,
      improvements: run.improvements,
      to_interview: 0,
    });
    p.expire(key, SESSION_TTL_SEC);
    p.zadd(CV_RUNS_INDEX, { score: now, member: id });
    p.zremrangebyscore(CV_RUNS_INDEX, 0, now - SESSION_TTL_SEC * 1000);
    await p.exec();
    return id;
  } catch (err) {
    console.error("[stats] cv run failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// Clic sur « Préparer un entretien avec ce CV » : compté une seule fois par analyse.
export async function recordCvToInterview(id: string) {
  if (!isValidSessionId(id)) return;
  await safely(async (client) => {
    const key = cvRunKey(id);
    if (!(await client.hexists(key, "at"))) return;
    const first = await client.hsetnx(key, "to_interview_at", Date.now());
    if (!first) return;
    await client.hset(key, { to_interview: 1 });
    await incrementStats({ cv_to_interview: 1 });
  });
}

export async function getRecentCvAnalyses(limit: number): Promise<CvRunRecord[]> {
  const client = getRedis();
  if (!client) return [];
  const ids = (await client.zrange(CV_RUNS_INDEX, 0, limit - 1, { rev: true })) as string[];
  if (!ids.length) return [];
  const p = client.pipeline();
  for (const id of ids) p.hgetall(cvRunKey(id));
  const rows = (await p.exec()) as (Record<string, unknown> | null)[];

  const runs: CvRunRecord[] = [];
  ids.forEach((id, i) => {
    const row = rows[i];
    const at = Number(row?.at);
    if (!row || !at) return;
    const status = String(row.status);
    runs.push({
      id,
      at,
      durationMs: Number(row.duration_ms) || 0,
      status: status === "ok" || status === "partial" ? status : "failed",
      degreeGiven: Number(row.degree) === 1,
      mismatch: Number(row.mismatch) === 1,
      improvements: Number(row.improvements) || 0,
      toInterview: Number(row.to_interview) === 1,
    });
  });
  return runs;
}
