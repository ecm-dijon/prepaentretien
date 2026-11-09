import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailyStats, isStatsConfigured, type DayStats } from "@/lib/stats";

export const metadata: Metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

type Totals = Omit<DayStats, "date">;

function sum(days: DayStats[]): Totals {
  return days.reduce(
    (acc, d) => {
      for (const key of Object.keys(acc) as (keyof Totals)[]) acc[key] += d[key];
      return acc;
    },
    { started: 0, profile_filled: 0, engaged: 0, answers: 0, completed: 0, completed_answers: 0, duration_sec: 0, pdf: 0 }
  );
}

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)} %` : "—");
const avg = (total: number, count: number, digits = 1) =>
  count ? (total / count).toLocaleString("fr-FR", { maximumFractionDigits: digits }) : "—";
const minutes = (sec: number, count: number) => {
  if (!count) return "—";
  const m = Math.round(sec / count / 60);
  return m < 1 ? "< 1 min" : `${m} min`;
};
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export default async function StatsPage() {
  const configured = isStatsConfigured();
  const days = configured ? await getDailyStats(90) : [];
  const last7 = sum(days.slice(-7));
  const last30 = sum(days.slice(-30));
  const last90 = sum(days);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 items-center border-b border-border/60 px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statistiques d&apos;usage</h1>
          <p className="text-muted-foreground">
            Compteurs anonymes uniquement : aucun contenu de session, aucun identifiant étudiant.
          </p>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Simulations démarrées (30 j)" value={last30.started.toLocaleString("fr-FR")} hint={`${last7.started} sur 7 jours`} />
              <Kpi label="Ont répondu au moins une fois" value={pct(last30.engaged, last30.started)} hint={plural(last30.engaged, "simulation")} />
              <Kpi label="Menées jusqu'au bout" value={pct(last30.completed, last30.started)} hint={`${plural(last30.completed, "simulation")} terminée${last30.completed > 1 ? "s" : ""}`} />
              <Kpi label="Durée moyenne (terminées)" value={minutes(last30.duration_sec, last30.completed)} hint={`${avg(last30.completed_answers, last30.completed)} réponses en moyenne`} />
            </div>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Synthèse</CardTitle>
                <CardDescription>Comparaison sur 7, 30 et 90 jours.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">Indicateur</th>
                      <th className="py-2 text-right font-medium">7 jours</th>
                      <th className="py-2 text-right font-medium">30 jours</th>
                      <th className="py-2 text-right font-medium">90 jours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {(
                      [
                        ["Simulations démarrées", (t: Totals) => t.started.toLocaleString("fr-FR")],
                        ["dont profil renseigné", (t: Totals) => pct(t.profile_filled, t.started)],
                        ["Ont répondu au moins une fois", (t: Totals) => pct(t.engaged, t.started)],
                        ["Réponses envoyées au coach", (t: Totals) => t.answers.toLocaleString("fr-FR")],
                        ["Simulations terminées", (t: Totals) => `${t.completed} (${pct(t.completed, t.started)})`],
                        ["Réponses par simulation terminée", (t: Totals) => avg(t.completed_answers, t.completed)],
                        ["Durée moyenne d'une simulation terminée", (t: Totals) => minutes(t.duration_sec, t.completed)],
                        ["Comptes rendus PDF téléchargés", (t: Totals) => `${t.pdf} (${pct(t.pdf, t.completed)} des terminées)`],
                      ] as const
                    ).map(([label, fn]) => (
                      <tr key={label}>
                        <td className="py-2">{label}</td>
                        <td className="py-2 text-right">{fn(last7)}</td>
                        <td className="py-2 text-right">{fn(last30)}</td>
                        <td className="py-2 text-right">{fn(last90)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Détail par jour (30 derniers jours)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">Jour</th>
                      <th className="py-2 text-right font-medium">Démarrées</th>
                      <th className="py-2 text-right font-medium">Avec réponse</th>
                      <th className="py-2 text-right font-medium">Terminées</th>
                      <th className="py-2 text-right font-medium">Réponses</th>
                      <th className="py-2 text-right font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {days
                      .slice(-30)
                      .reverse()
                      .map((d) => (
                        <tr key={d.date} className={d.started ? "" : "text-muted-foreground"}>
                          <td className="py-2">{formatDay(d.date)}</td>
                          <td className="py-2 text-right">{d.started}</td>
                          <td className="py-2 text-right">{d.engaged}</td>
                          <td className="py-2 text-right">{d.completed}</td>
                          <td className="py-2 text-right">{d.answers}</td>
                          <td className="py-2 text-right">{d.pdf}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-1 py-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
