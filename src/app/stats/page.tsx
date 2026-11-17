import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

// Au-delà de 30 min sans activité, une simulation non terminée est
// considérée comme abandonnée.
const IDLE_MS = 30 * 60 * 1000;
const SESSIONS_SHOWN = 200;

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
const pctValue = (part: number, total: number) => (total ? Math.round((part / total) * 100) : null);
// « 12 sur 15 (80 %) » — toujours le nombre réel à côté du pourcentage.
const outOf = (part: number, total: number) =>
  total ? `${fr(part)} sur ${fr(total)} (${pctValue(part, total)} %)` : "—";
const avg = (total: number, count: number) =>
  count ? (total / count).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—";
function formatDuration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "moins d'1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
const avgDuration = (sec: number, count: number) => (count ? formatDuration((sec / count) * 1000) : "—");
const plural = (n: number, word: string) => `${fr(n)} ${word}${n > 1 ? "s" : ""}`;
const pctText = (part: number, total: number) => {
  const v = pctValue(part, total);
  return v === null ? "—" : `${v} %`;
};
function formatSeconds(ms: number) {
  const sec = Math.round(ms / 1000);
  return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")}`;
}
const avgSeconds = (sec: number, count: number) => (count ? formatSeconds((sec / count) * 1000) : "—");
// Une analyse demandée se termine soit avec un résultat (complet ou
// partiel), soit en échec.
const cvRequested = (t: Totals) => t.cv + t.cv_failed;

const CV_STATUS: Record<CvRunRecord["status"], { label: string; tone: Status["tone"] }> = {
  ok: { label: "Complète", tone: "done" },
  partial: { label: "Partielle", tone: "partial" },
  failed: { label: "Échouée", tone: "none" },
};

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
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

type Status = { label: string; tone: "done" | "live" | "partial" | "none" };
function sessionStatus(s: SessionRecord, now: number): Status {
  if (s.completedAt) return { label: "Terminée", tone: "done" };
  if (now - s.lastActivityAt < IDLE_MS) return { label: "En cours", tone: "live" };
  if (s.answers === 0) return { label: "Quittée sans répondre", tone: "none" };
  return { label: "Abandonnée en cours de route", tone: "partial" };
}
const TONE_CLASS: Record<Status["tone"], string> = {
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  live: "bg-primary/15 text-primary",
  partial: "bg-ecm-orange/15 text-ecm-orange",
  none: "bg-muted text-muted-foreground",
};

export default async function StatsPage() {
  const configured = isStatsConfigured();
  const [days, sessions, cvRuns] = configured
    ? await Promise.all([getDailyStats(90), getRecentSessions(SESSIONS_SHOWN), getRecentCvAnalyses(SESSIONS_SHOWN)])
    : [[], [], []];
  const now = Date.now();
  const last7 = sum(days.slice(-7));
  const last30 = sum(days.slice(-30));
  const last90 = sum(days);

  const interviewRows: Row[] = [
    {
      label: "Simulations démarrées",
      help: "Nombre de fois où quelqu'un a cliqué sur « Démarrer la simulation ».",
      value: (t) => fr(t.started),
    },
    {
      label: "Avec le profil renseigné",
      help: "Simulations où l'étudiant·e a rempli au moins un champ du formulaire de départ (diplôme, expériences…).",
      value: (t) => outOf(t.profile_filled, t.started),
    },
    {
      label: "Avec au moins une réponse",
      help: "Simulations où l'étudiant·e a réellement échangé avec le coach (sinon : il/elle est parti·e sans répondre).",
      value: (t) => outOf(t.engaged, t.started),
    },
    {
      label: "Menées jusqu'au bout",
      help: "Simulations terminées avec le bouton « Terminer la session » (compte rendu généré).",
      value: (t) => outOf(t.completed, t.started),
    },
    {
      label: "Durée moyenne d'une simulation terminée",
      help: "Du clic sur « Démarrer » au clic sur « Terminer la session ».",
      value: (t) => avgDuration(t.duration_sec, t.completed),
    },
    {
      label: "Réponses par simulation terminée",
      help: "Nombre moyen de messages envoyés au coach dans une simulation terminée.",
      value: (t) => avg(t.completed_answers, t.completed),
    },
    {
      label: "Total des réponses envoyées",
      help: "Tous les messages envoyés au coach, simulations terminées ou non.",
      value: (t) => fr(t.answers),
    },
    {
      label: "Comptes rendus PDF téléchargés",
      help: "Parmi les simulations terminées, combien ont téléchargé leur compte rendu.",
      value: (t) => outOf(t.pdf, t.completed),
    },
  ];

  const cvRows: Row[] = [
    {
      label: "Analyses lancées",
      help: "Nombre de CV déposés puis envoyés à l'analyse (aucun CV n'est conservé).",
      value: (t) => fr(cvRequested(t)),
    },
    {
      label: "Analyses abouties",
      help: "Analyses qui ont donné un résultat (complet, ou partiel si l'avis ou la lecture des informations a manqué).",
      value: (t) => outOf(t.cv, cvRequested(t)),
    },
    {
      label: "dont partielles",
      help: "L'avis sur le CV ou la lecture de ses informations n'a pas abouti, l'autre partie s'est affichée.",
      value: (t) => outOf(t.cv_partial, t.cv),
    },
    {
      label: "Analyses en échec",
      help: "Aucun résultat : service d'IA indisponible ou trop lent. À surveiller si ce chiffre augmente.",
      value: (t) => outOf(t.cv_failed, cvRequested(t)),
    },
    {
      label: "Temps moyen d'analyse",
      help: "Du dépôt du CV à l'affichage du résultat, pour les analyses abouties.",
      value: (t) => avgSeconds(t.cv_duration_sec, t.cv),
    },
    {
      label: "Avec le diplôme indiqué",
      help: "Analyses où l'étudiant·e a indiqué son diplôme (vérification de la cohérence CV / formation).",
      value: (t) => outOf(t.cv_degree, t.cv),
    },
    {
      label: "Écart CV / diplôme signalé",
      help: "Parmi les analyses avec diplôme indiqué, celles où le CV semblait correspondre à une autre formation.",
      value: (t) => outOf(t.cv_mismatch, t.cv_degree),
    },
    {
      label: "Suivies d'une prépa entretien",
      help: "Analyses après lesquelles l'étudiant·e a cliqué sur « Préparer un entretien avec ce CV ».",
      value: (t) => outOf(t.cv_to_interview, t.cv),
    },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 items-center border-b border-border/60 px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Statistiques d&apos;usage</h1>
          <nav className="flex flex-wrap gap-2 text-sm">
            <a href="#entretien" className="rounded-full border border-border px-3 py-1 hover:bg-accent">
              Préparer un entretien
            </a>
            <a href="#cv" className="rounded-full border border-border px-3 py-1 hover:bg-accent">
              Analyser mon CV
            </a>
            <a href="#jours" className="rounded-full border border-border px-3 py-1 hover:bg-accent">
              Jour par jour
            </a>
          </nav>
        </div>

        {!configured ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Les statistiques ne sont pas encore activées : créez une base Upstash Redis dans Vercel
              (Storage) et reliez-la à ce projet, puis redéployez. Voir le README.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ------------------------------------------------ Entretien */}
            <section id="entretien" className="scroll-mt-6 space-y-6">
              <SectionTitle
                title="Préparer un entretien"
                text="Une simulation = une fois où un·e étudiant·e clique sur « Démarrer la simulation »."
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  value={fr(last30.started)}
                  label={last30.started > 1 ? "simulations démarrées (30 j)" : "simulation démarrée (30 j)"}
                  hint={`dont ${plural(last7.started, "simulation")} ces 7 derniers jours`}
                />
                <Kpi
                  value={pctText(last30.engaged, last30.started)}
                  label="ont échangé avec le coach"
                  hint={`${plural(last30.engaged, "simulation")} sur ${fr(last30.started)} avec au moins une réponse`}
                />
                <Kpi
                  value={pctText(last30.completed, last30.started)}
                  label="menées jusqu'au bout"
                  hint={`${plural(last30.completed, "simulation")} sur ${fr(last30.started)} terminée${last30.completed > 1 ? "s" : ""} avec compte rendu`}
                />
                <Kpi
                  value={avgDuration(last30.duration_sec, last30.completed)}
                  label="durée moyenne d'une simulation terminée"
                  hint={`${avg(last30.completed_answers, last30.completed)} réponses en moyenne`}
                />
              </div>

              {sessions.length > 0 && (
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle className="text-base">Simulations individuelles</CardTitle>
                    <CardDescription>
                      Une ligne par simulation (les {SESSIONS_SHOWN} plus récentes, conservées 90 jours).
                      Une simulation non terminée est « abandonnée » après 30 min sans activité.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 font-medium">Début</th>
                          <th className="py-2 font-medium">Durée</th>
                          <th className="py-2 text-right font-medium">Réponses</th>
                          <th className="py-2 pl-6 font-medium">Statut</th>
                          <th className="py-2 font-medium">Profil rempli</th>
                          <th className="py-2 font-medium">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border tabular-nums">
                        {sessions.map((s) => {
                          const status = sessionStatus(s, now);
                          const end = s.completedAt ?? s.lastActivityAt;
                          return (
                            <tr key={s.id}>
                              <td className="py-2 first-letter:uppercase">{formatDateTime(s.startedAt)}</td>
                              <td className="py-2">
                                {s.answers === 0 && !s.completedAt ? "—" : formatDuration(end - s.startedAt)}
                              </td>
                              <td className="py-2 text-right">{s.answers}</td>
                              <td className="py-2 pl-6">
                                <StatusPill label={status.label} tone={status.tone} />
                              </td>
                              <td className="py-2">{s.profileFilled ? "Oui" : "Non"}</td>
                              <td className="py-2">{s.pdf ? "Téléchargé" : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              <OverviewTable rows={interviewRows} totals={[last7, last30, last90]} />
            </section>

            {/* ------------------------------------------------ CV */}
            <section id="cv" className="scroll-mt-6 space-y-6">
              <SectionTitle
                title="Analyser mon CV"
                text="Une analyse = un CV déposé puis envoyé à l'IA. Aucun CV n'est conservé : seuls ces compteurs le sont."
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  value={fr(cvRequested(last30))}
                  label={cvRequested(last30) > 1 ? "analyses lancées (30 j)" : "analyse lancée (30 j)"}
                  hint={`dont ${plural(cvRequested(last7), "analyse")} ces 7 derniers jours`}
                />
                <Kpi
                  value={pctText(last30.cv, cvRequested(last30))}
                  label="ont abouti"
                  hint={`${plural(last30.cv_failed, "analyse")} en échec sur ${fr(cvRequested(last30))}`}
                />
                <Kpi
                  value={avgSeconds(last30.cv_duration_sec, last30.cv)}
                  label="temps moyen d'analyse"
                  hint="du dépôt du CV à l'affichage du résultat"
                />
                <Kpi
                  value={pctText(last30.cv_to_interview, last30.cv)}
                  label="ont enchaîné sur une prépa entretien"
                  hint={`${plural(last30.cv_to_interview, "analyse")} sur ${fr(last30.cv)} suivie${last30.cv_to_interview > 1 ? "s" : ""} d'une simulation`}
                />
              </div>

              {cvRuns.length > 0 && (
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle className="text-base">Analyses individuelles</CardTitle>
                    <CardDescription>
                      Une ligne par analyse (les {SESSIONS_SHOWN} plus récentes, conservées 90 jours), sans
                      aucun contenu du CV.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 font-medium">Date</th>
                          <th className="py-2 font-medium">Temps d&apos;analyse</th>
                          <th className="py-2 font-medium">Résultat</th>
                          <th className="py-2 text-right font-medium">Points à améliorer</th>
                          <th className="py-2 pl-6 font-medium">Diplôme indiqué</th>
                          <th className="py-2 font-medium">Écart signalé</th>
                          <th className="py-2 font-medium">Prépa entretien ensuite</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border tabular-nums">
                        {cvRuns.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 first-letter:uppercase">{formatDateTime(r.at)}</td>
                            <td className="py-2">{formatSeconds(r.durationMs)}</td>
                            <td className="py-2">
                              <StatusPill label={CV_STATUS[r.status].label} tone={CV_STATUS[r.status].tone} />
                            </td>
                            <td className="py-2 text-right">{r.status === "failed" ? "—" : r.improvements}</td>
                            <td className="py-2 pl-6">{r.degreeGiven ? "Oui" : "Non"}</td>
                            <td className="py-2">{r.mismatch ? "Oui" : "—"}</td>
                            <td className="py-2">{r.toInterview ? "Oui" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              <OverviewTable rows={cvRows} totals={[last7, last30, last90]} />
            </section>

            {/* ------------------------------------------------ Jour par jour */}
            <section id="jours" className="scroll-mt-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base">Jour par jour (30 derniers jours)</CardTitle>
                  <CardDescription>Activité des deux outils, jour par jour.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 font-medium">Jour</th>
                        <th className="py-2 text-right font-medium">Simulations démarrées</th>
                        <th className="py-2 text-right font-medium">Avec réponse</th>
                        <th className="py-2 text-right font-medium">Terminées</th>
                        <th className="py-2 text-right font-medium">PDF téléchargés</th>
                        <th className="py-2 text-right font-medium">CV analysés</th>
                        <th className="py-2 text-right font-medium">CV en échec</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border tabular-nums">
                      {days
                        .slice(-30)
                        .reverse()
                        .map((d) => (
                          <tr
                            key={d.date}
                            className={d.started || d.cv || d.cv_failed ? "" : "text-muted-foreground"}
                          >
                            <td className="py-2 first-letter:uppercase">{formatDay(d.date)}</td>
                            <td className="py-2 text-right">{d.started}</td>
                            <td className="py-2 text-right">{d.engaged}</td>
                            <td className="py-2 text-right">{d.completed}</td>
                            <td className="py-2 text-right">{d.pdf}</td>
                            <td className="py-2 text-right">{d.cv}</td>
                            <td className="py-2 text-right">{d.cv_failed}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

type Row = { label: string; help: string; value: (t: Totals) => string };

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-1 border-b border-border pb-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: Status["tone"] }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone])}>{label}</span>;
}

function OverviewTable({ rows, totals }: { rows: Row[]; totals: [Totals, Totals, Totals] }) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Vue globale</CardTitle>
        <CardDescription>
          Les mêmes indicateurs sur 7, 30 et 90 jours, avec à chaque fois le nombre réel et le pourcentage
          correspondant.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Indicateur</th>
              <th className="py-2 text-right font-medium">7 derniers jours</th>
              <th className="py-2 text-right font-medium">30 derniers jours</th>
              <th className="py-2 text-right font-medium">90 derniers jours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <td className="py-2.5 pr-4">
                  <span className="font-medium">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.help}</span>
                </td>
                {totals.map((t, i) => (
                  <td key={i} className="py-2.5 text-right whitespace-nowrap">
                    {row.value(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Kpi({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-1 py-5">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
