import { ChevronDown, FileText, Mic, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import {
  getDailyStats,
  getRecentCvAnalyses,
  getRecentSessions,
  isStatsConfigured,
  STAT_FIELDS,
  type CvRunRecord,
  type DayStats,
  type SessionRecord,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

// Une seule question par écran : « est-ce que les étudiant·e·s utilisent les
// outils, et vont-ils au bout ? ». Une période à la fois (7 / 30 / 90 jours),
// un grand chiffre par outil, le parcours étape par étape, l'activité par
// jour ; le détail ligne par ligne est replié.

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

// Au-delà de 30 min sans activité, une simulation non terminée est
// considérée comme abandonnée.
const IDLE_MS = 30 * 60 * 1000;
const DETAIL_LIMIT = 200;

type Totals = Omit<DayStats, "date">;

function sum(days: DayStats[]): Totals {
  return days.reduce(
    (acc, d) => {
      for (const key of Object.keys(acc) as (keyof Totals)[]) acc[key] += d[key];
      return acc;
    },
    Object.fromEntries(STAT_FIELDS.map((f) => [f, 0])) as Totals
  );
}

const fr = (n: number) => n.toLocaleString("fr-FR");
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const plural = (n: number, one: string, many: string) => `${fr(n)} ${n > 1 ? many : one}`;

function formatDuration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "moins d'1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
function formatSeconds(ms: number) {
  const sec = Math.round(ms / 1000);
  return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")}`;
}
function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function formatShortDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tone = "done" | "live" | "partial" | "none";
const TONE_CLASS: Record<Tone, string> = {
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  live: "bg-primary/15 text-primary",
  partial: "bg-ecm-orange/15 text-ecm-orange",
  none: "bg-muted text-muted-foreground",
};

function sessionStatus(s: SessionRecord, now: number): { label: string; tone: Tone } {
  if (s.completedAt) return { label: "Terminée", tone: "done" };
  if (now - s.lastActivityAt < IDLE_MS) return { label: "En cours", tone: "live" };
  if (s.answers === 0) return { label: "Quittée sans répondre", tone: "none" };
  return { label: "Abandonnée en cours de route", tone: "partial" };
}

const CV_STATUS: Record<CvRunRecord["status"], { label: string; tone: Tone }> = {
  ok: { label: "Complète", tone: "done" },
  partial: { label: "Partielle", tone: "partial" },
  failed: { label: "Échouée", tone: "none" },
};

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period: Period = (PERIODS as readonly number[]).includes(Number(p)) ? (Number(p) as Period) : 30;

  const configured = isStatsConfigured();
  const [allDays, allSessions, allCvRuns] = configured
    ? await Promise.all([getDailyStats(90), getRecentSessions(DETAIL_LIMIT), getRecentCvAnalyses(DETAIL_LIMIT)])
    : [[], [], []];

  const now = Date.now();
  const since = now - period * 24 * 3600 * 1000;
  const days = allDays.slice(-period);
  const t = sum(days);
  const sessions = allSessions.filter((s) => s.startedAt >= since);
  const cvRuns = allCvRuns.filter((r) => r.at >= since);
  const cvRequested = t.cv + t.cv_failed;

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="flex h-14 items-center border-b border-border/60 bg-background px-4 sm:px-6">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Statistiques d&apos;usage</h1>
            <p className="text-sm text-muted-foreground">
              Anonymes : aucun nom, aucun contenu de simulation ni de CV.
            </p>
          </div>
          <nav aria-label="Période" className="inline-flex rounded-full border border-border bg-background p-1 text-sm">
            {PERIODS.map((d) => (
              <Link
                key={d}
                href={`/stats?p=${d}`}
                aria-current={d === period ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 font-medium transition-colors",
                  d === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d} jours
              </Link>
            ))}
          </nav>
        </div>

        {!configured ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              Les statistiques ne sont pas encore activées : créez une base Upstash Redis dans Vercel (Storage),
              reliez-la à ce projet, puis redéployez.
            </p>
          </Panel>
        ) : (
          <>
            {/* -------------------------------------------- Prépa entretien */}
            <Panel>
              <ToolHeader icon={<Mic className="size-5" />} title="Préparer un entretien" />

              <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-6">
                  <Hero
                    value={t.started}
                    unit={t.started > 1 ? "simulations" : "simulation"}
                    sentence={
                      t.started
                        ? `Dont ${plural(t.completed, "menée", "menées")} jusqu'au compte rendu (${pct(t.completed, t.started)} %).`
                        : `Aucune simulation sur les ${period} derniers jours.`
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Durée moyenne"
                      value={t.completed ? formatDuration((t.duration_sec / t.completed) * 1000) : "—"}
                      hint="d'une simulation terminée"
                    />
                    <MiniStat
                      label="Réponses en moyenne"
                      value={t.completed ? (t.completed_answers / t.completed).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}
                      hint="par simulation terminée"
                    />
                  </div>
                </div>

                <Steps
                  title="Jusqu'où vont les étudiant·e·s ?"
                  total={t.started}
                  steps={[
                    { label: "Ont démarré une simulation", value: t.started },
                    { label: "Ont répondu au moins une fois", value: t.engaged },
                    { label: "Sont allés jusqu'au compte rendu", value: t.completed },
                    { label: "Ont téléchargé le PDF", value: t.pdf },
                  ]}
                />
              </div>

              <DailyBars days={days} pick={(d) => d.started} unit={["simulation", "simulations"]} title="Simulations par jour" />

              <Details summary={`Voir le détail des simulations (${fr(sessions.length)})`}>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune simulation sur cette période.</p>
                ) : (
                  <DataTable
                    head={["Début", "Durée", "Réponses", "Statut", "Profil rempli", "PDF"]}
                    rows={sessions.map((s) => {
                      const status = sessionStatus(s, now);
                      const end = s.completedAt ?? s.lastActivityAt;
                      return {
                        key: s.id,
                        cells: [
                          formatDateTime(s.startedAt),
                          s.answers === 0 && !s.completedAt ? "—" : formatDuration(end - s.startedAt),
                          String(s.answers),
                          <Pill key="s" label={status.label} tone={status.tone} />,
                          s.profileFilled ? "Oui" : "Non",
                          s.pdf ? "Téléchargé" : "—",
                        ],
                      };
                    })}
                  />
                )}
              </Details>
            </Panel>

            {/* -------------------------------------------- Analyse de CV */}
            <Panel>
              <ToolHeader icon={<FileText className="size-5" />} title="Analyser mon CV" />

              <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-6">
                  <Hero
                    value={t.cv}
                    unit={t.cv > 1 ? "CV analysés" : "CV analysé"}
                    sentence={
                      t.cv
                        ? `${plural(t.cv_to_interview, "a ensuite préparé", "ont ensuite préparé")} un entretien (${pct(t.cv_to_interview, t.cv)} %).`
                        : `Aucun CV analysé sur les ${period} derniers jours.`
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Temps d'analyse"
                      value={t.cv ? formatSeconds((t.cv_duration_sec / t.cv) * 1000) : "—"}
                      hint="en moyenne"
                    />
                    <MiniStat
                      label="Échecs"
                      value={fr(t.cv_failed)}
                      hint={cvRequested ? `sur ${plural(cvRequested, "analyse lancée", "analyses lancées")}` : "aucune analyse lancée"}
                      warn={t.cv_failed > 0 && pct(t.cv_failed, cvRequested) >= 20}
                    />
                  </div>
                </div>

                <Steps
                  title="Que se passe-t-il après le dépôt du CV ?"
                  total={cvRequested}
                  steps={[
                    { label: "Ont lancé une analyse", value: cvRequested },
                    { label: "Ont obtenu leur analyse", value: t.cv },
                    { label: "Ont indiqué leur diplôme", value: t.cv_degree },
                    { label: "Ont enchaîné sur une prépa entretien", value: t.cv_to_interview },
                  ]}
                />
              </div>

              <DailyBars days={days} pick={(d) => d.cv} unit={["CV analysé", "CV analysés"]} title="CV analysés par jour" />

              <Details summary={`Voir le détail des analyses (${fr(cvRuns.length)})`}>
                {cvRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune analyse détaillée sur cette période.</p>
                ) : (
                  <DataTable
                    head={["Date", "Temps d'analyse", "Résultat", "Points à améliorer", "Diplôme indiqué", "Écart signalé", "Prépa entretien ensuite"]}
                    rows={cvRuns.map((r) => ({
                      key: r.id,
                      cells: [
                        formatDateTime(r.at),
                        formatSeconds(r.durationMs),
                        <Pill key="s" label={CV_STATUS[r.status].label} tone={CV_STATUS[r.status].tone} />,
                        r.status === "failed" ? "—" : String(r.improvements),
                        r.degreeGiven ? "Oui" : "Non",
                        r.mismatch ? "Oui" : "—",
                        r.toInterview ? "Oui" : "—",
                      ],
                    }))}
                  />
                )}
              </Details>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- Pièces

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="space-y-8 rounded-2xl border border-border bg-card p-5 sm:p-8">{children}</section>;
}

function ToolHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">{icon}</span>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

// Le chiffre principal de l'outil, avec une phrase qui le traduit en clair.
function Hero({ value, unit, sentence }: { value: number; unit: string; sentence: string }) {
  return (
    <div className="space-y-2">
      <p className="flex items-baseline gap-3">
        <span className="text-6xl font-semibold tracking-tight">{fr(value)}</span>
        <span className="text-lg font-medium text-muted-foreground">{unit}</span>
      </p>
      <p className="text-base">{sentence}</p>
    </div>
  );
}

function MiniStat({ label, value, hint, warn = false }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", warn ? "border-ecm-orange/50 bg-ecm-orange/[0.06]" : "border-border")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {warn && <TriangleAlert className="size-3.5 text-ecm-orange" aria-hidden />}
        {label}
        {warn && <span className="sr-only"> (à surveiller)</span>}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {warn && <p className="mt-1 text-xs font-medium text-ecm-orange">À surveiller</p>}
    </div>
  );
}

// Parcours étape par étape : une barre par étape, toutes rapportées au
// nombre de départ, pour voir d'un coup d'œil où les étudiant·e·s décrochent.
function Steps({ title, total, steps }: { title: string; total: number; steps: { label: string; value: number }[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="space-y-4">
        {steps.map((step) => {
          const share = pct(step.value, total);
          return (
            <li key={step.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{step.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {fr(step.value)}
                  {total > 0 && <span className="ml-1.5 font-normal text-muted-foreground">{share} %</span>}
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-primary/15"
                role="img"
                aria-label={`${step.label} : ${fr(step.value)}${total ? ` (${share} %)` : ""}`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${total ? share : 0}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Activité par jour : une colonne par jour (une seule série, une couleur),
// le chiffre exact au survol ou au focus clavier.
function DailyBars({
  days,
  pick,
  unit,
  title,
}: {
  days: DayStats[];
  pick: (d: DayStats) => number;
  unit: [string, string];
  title: string;
}) {
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const totalDays = days.length;
  const labelIdx = new Set([0, Math.floor((totalDays - 1) / 2), totalDays - 1]);

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">Maximum : {fr(Math.max(...values, 0))} sur un jour</span>
      </figcaption>
      <div className="relative">
        <div className="flex h-32 items-end gap-[2px] border-b border-border">
          {days.map((d, i) => {
            const v = values[i];
            const label = `${formatDay(d.date)} : ${v} ${v > 1 ? unit[1] : unit[0]}`;
            return (
              <div
                key={d.date}
                tabIndex={0}
                aria-label={label}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <div
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] transition-colors",
                    v ? "bg-primary group-hover:bg-primary/80 group-focus-visible:bg-primary/80" : "bg-transparent"
                  )}
                  style={{ height: v ? `${Math.max((v / max) * 100, 4)}%` : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background group-hover:block group-focus-visible:block first-letter:uppercase">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex text-xs text-muted-foreground">
          {days.map((d, i) => (
            <span key={d.date} className="flex-1 text-center whitespace-nowrap">
              {labelIdx.has(i) ? formatShortDay(d.date) : ""}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

function Details({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium hover:bg-accent/40">
        {summary}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="overflow-x-auto border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

function Pill({ label, tone }: { label: string; tone: Tone }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone])}>{label}</span>;
}

function DataTable({ head, rows }: { head: string[]; rows: { key: string; cells: React.ReactNode[] }[] }) {
  return (
    <table className="w-full min-w-[680px] text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          {head.map((h) => (
            <th key={h} className="py-2 pr-4 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border tabular-nums">
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) => (
              <td key={i} className={cn("py-2 pr-4", i === 0 && "first-letter:uppercase")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
