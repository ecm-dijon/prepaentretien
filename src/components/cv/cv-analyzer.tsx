"use client";

import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeCvAction } from "@/lib/actions/cv-analysis";
import type { CvExtraction, CvReview } from "@/lib/ai/cv-analysis";
import { DEGREE_OPTIONS, YEAR_LEVEL_OPTIONS } from "@/lib/degree-options";
import { NoStorageWarning } from "@/components/shared/no-storage-warning";
import { cn } from "@/lib/utils";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

import type { StudentForm } from "../interview-prep/types";

const MAX_BYTES = 4 * 1024 * 1024;

const SKILL_CATEGORY_LABELS: Record<string, string> = {
  technique: "Technique",
  humaine: "Savoir-être",
  metier: "Métier",
  linguistique: "Langue",
  numerique: "Numérique",
};
const SKILL_LEVEL_LABELS: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  expert: "Expert",
};
const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  stage: "Stage",
  alternance: "Alternance",
  emploi: "Emploi",
  associatif: "Associatif",
  benevolat: "Bénévolat",
};

function formatMonth(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

type Result = {
  extraction: CvExtraction | null;
  review: CvReview | null;
  previewDataUrl: string | null;
  fileName: string;
};

// Analyseur de CV — même analyse que la Plateforme des Compétences (CV type
// ECM comme référence), mais rien n'est stocké : le CV est envoyé, analysé,
// et le résultat n'existe que dans cette page.
export function CvAnalyzer({ onPrepareInterview }: { onPrepareInterview: (form: Partial<StudentForm>) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [degree, setDegree] = useState("");
  const [year, setYear] = useState("");
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Avertit avant de fermer / recharger la page : l'analyse serait perdue.
  useEffect(() => {
    if (!result && !analyzing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [result, analyzing]);

  function pickFile(candidate: File | undefined | null) {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Format PDF uniquement : exportez votre CV en PDF depuis Word, Canva…");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      toast.error("Fichier trop lourd (4 Mo maximum).");
      return;
    }
    setFile(candidate);
  }

  async function handleAnalyze() {
    if (!file || analyzing) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("cv", file);
      formData.append("degree", degree);
      formData.append("year", year);
      const res = await withTimeout(analyzeCvAction(formData), 75_000);
      if (res.success) {
        setResult({
          extraction: res.extraction,
          review: res.review,
          previewDataUrl: res.previewDataUrl,
          fileName: file.name,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(
        err instanceof TimeoutError
          ? "L'analyse prend trop de temps. Réessayez dans un instant."
          : "L'analyse du CV a échoué. Réessayez dans quelques instants."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function handleReset() {
    setResult(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handlePrepare() {
    if (!result) return;
    const x = result.extraction ?? {};
    onPrepareInterview({
      headline: x.headline ?? "",
      degree,
      currentYear: year,
      skills: (x.skills ?? []).map((s) => s.name).join(", "),
      experiences: (x.experiences ?? [])
        .map((e) => `${e.title} — ${e.organization} (${EXPERIENCE_TYPE_LABELS[e.experience_type] ?? e.experience_type})`)
        .join("\n"),
    });
  }

  if (result) {
    return (
      <PageShell width="max-w-6xl">
        <CvResult
          result={result}
          onReset={handleReset}
          onPrepare={handlePrepare}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-6 space-y-2 text-center sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Analysez votre CV</h1>
        <p className="text-muted-foreground">
          L&apos;IA compare votre CV au CV type de l&apos;ECM, relève ses points forts et vous donne des
          pistes concrètes pour l&apos;améliorer avant de l&apos;envoyer.
        </p>
      </div>

      <div className="mb-5 sm:mb-6">
        <CvNoStorageWarning />
      </div>

      <Card className="shadow-soft">
        <CardContent className="space-y-6 px-4 py-6 sm:px-6">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            disabled={analyzing}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-accent/40",
              file && "border-solid border-primary/50 bg-primary/5"
            )}
          >
            {file ? (
              <>
                <FileText className="size-10 text-primary" />
                <span className="font-medium break-all">{file.name}</span>
                <span className="text-sm text-muted-foreground">Cliquez pour choisir un autre fichier</span>
              </>
            ) : (
              <>
                <Upload className="size-10 text-muted-foreground" />
                <span className="font-medium">Déposez votre CV ici ou cliquez pour le choisir</span>
                <span className="text-sm text-muted-foreground">Format PDF, 4 Mo maximum</span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Facultatif : indiquez votre formation pour que l&apos;IA vérifie que votre CV y correspond bien.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cv-degree">Diplôme préparé</Label>
                <Select value={degree || undefined} onValueChange={setDegree}>
                  <SelectTrigger id="cv-degree" className="w-full">
                    <SelectValue placeholder="Choisissez votre diplôme" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_OPTIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cv-year">Année</Label>
                <Select value={year || undefined} onValueChange={setYear}>
                  <SelectTrigger id="cv-year" className="w-full">
                    <SelectValue placeholder="Choisissez votre année" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_LEVEL_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button type="button" size="lg" className="w-full" onClick={handleAnalyze} disabled={!file || analyzing}>
            {analyzing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analyse en cours (environ 30 secondes)…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Analyser mon CV
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function CvResult({ result, onReset, onPrepare }: { result: Result; onReset: () => void; onPrepare: () => void }) {
  const x = result.extraction;
  const review = result.review;
  const strengths = review?.strengths ?? [];
  const improvements = review?.improvements ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analyse de votre CV</h1>
          <p className="text-sm break-all text-muted-foreground">{result.fileName}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw className="size-4" /> Analyser un autre CV
          </Button>
          <Button type="button" onClick={onPrepare}>
            <Mic className="size-4" /> Préparer un entretien avec ce CV
          </Button>
        </div>
      </div>

      <CvNoStorageWarning />

      {review?.profile_mismatch && (
        <Card className="border-ecm-orange/40 bg-ecm-orange/[0.05] shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-ecm-orange" /> Ce CV correspond-il bien à votre formation ?
            </CardTitle>
            <CardDescription className="text-foreground/80">{review.profile_mismatch}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Avis sur votre CV</CardTitle>
          <CardDescription>
            Avis de l&apos;IA à partir du CV type de l&apos;ECM : à prendre comme des pistes, pas comme une
            vérité absolue. Comparez votre CV au CV type, en grand juste en dessous.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2">
          {!review ? (
            <p className="text-sm text-muted-foreground md:col-span-2">
              L&apos;avis n&apos;a pas pu être généré cette fois-ci. Relancez l&apos;analyse pour l&apos;obtenir.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Points forts</p>
                {strengths.length ? (
                  <ul className="space-y-2.5">
                    {strengths.map((point, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">À améliorer</p>
                {improvements.length ? (
                  <ul className="space-y-2.5">
                    {improvements.map((point, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                        <TriangleAlert className="mt-1 size-4 shrink-0 text-ecm-orange" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Rien de majeur à signaler.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Votre CV face au CV type ECM</CardTitle>
          <CardDescription>
            Mis côte à côte pour repérer d&apos;un coup d&apos;œil ce qui diffère. Cliquez sur un CV pour l&apos;agrandir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Votre CV</p>
            {result.previewDataUrl ? (
              <ZoomableCv src={result.previewDataUrl} alt="Aperçu de votre CV" title="Votre CV" />
            ) : (
              <div className="flex aspect-[1191/1685] items-center justify-center rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                Aperçu indisponible
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">CV type ECM</p>
            <ZoomableCv src="/reference-cv-alternance.png" alt="CV type ECM pour une recherche d'alternance" title="CV type ECM" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Ce que l&apos;IA a lu dans votre CV</CardTitle>
          <CardDescription>
            C&apos;est ce qu&apos;un recruteur retient en le parcourant : vérifiez que rien d&apos;important ne
            manque ou n&apos;est mal compris.
          </CardDescription>
        </CardHeader>
        {x ? <CvContent x={x} /> : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les informations du CV n&apos;ont pas pu être lues cette fois-ci. Relancez l&apos;analyse pour les obtenir.
            </p>
          </CardContent>
        )}
      </Card>

      <Card className="border-primary/30 bg-primary/[0.04] shadow-soft">
        <CardContent className="flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Et maintenant, entraînez-vous à l&apos;oral</p>
            <p className="text-sm text-muted-foreground">
              Le coach reprend votre parcours pour vous poser des questions d&apos;entretien sur mesure.
            </p>
          </div>
          <Button type="button" onClick={onPrepare} className="w-full sm:w-auto">
            Préparer un entretien avec ce CV <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CvContent({ x }: { x: CvExtraction }) {
  const skills = x.skills ?? [];
  const experiences = x.experiences ?? [];
  const certifications = x.certifications ?? [];
  return (
    <CardContent className="grid gap-6 md:grid-cols-2">
      <div className="space-y-5">
        <Info label="Titre / accroche" value={x.headline} />
        <Info label="Présentation" value={x.bio} />
        <Info label="Mobilité géographique" value={x.geographic_mobility} />
        <Info label="Type de recherche" value={x.availability_types?.join(", ")} />
        <Info
          label="Permis B"
          value={x.has_driving_license === undefined ? null : x.has_driving_license ? "Oui" : "Non"}
        />
        {(x.softwares?.length ?? 0) > 0 && (
          <Section title="Logiciels">
            <div className="flex flex-wrap gap-1.5">
              {x.softwares!.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </Section>
        )}
        {skills.length > 0 && (
          <Section title="Compétences">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <Badge key={`${s.name}-${i}`} variant="secondary" className="whitespace-normal">
                  {s.name} · {SKILL_CATEGORY_LABELS[s.category] ?? s.category}, {SKILL_LEVEL_LABELS[s.level] ?? s.level}
                </Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
      <div className="space-y-5">
        {experiences.length > 0 && (
          <Section title="Expériences">
            <ul className="space-y-3">
              {experiences.map((e, i) => (
                <li key={i} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">
                    {e.title} — {e.organization}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      EXPERIENCE_TYPE_LABELS[e.experience_type] ?? e.experience_type,
                      [formatMonth(e.start_date), formatMonth(e.end_date) ?? "aujourd'hui"].filter(Boolean).join(" → "),
                    ].join(" · ")}
                  </p>
                  {e.description && <p className="mt-1.5 text-muted-foreground">{e.description}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {certifications.length > 0 && (
          <Section title="Formations et certifications">
            <ul className="space-y-2">
              {certifications.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {c.issuer}
                    {c.issue_date ? ` (${new Date(`${c.issue_date}T12:00:00`).getFullYear()})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </CardContent>
  );
}

function CvNoStorageWarning() {
  return (
    <NoStorageWarning>
      <p className="font-semibold">Rien n&apos;est enregistré : attention aux fausses manipulations.</p>
      <p>
        Votre CV est analysé puis immédiatement oublié. Si vous fermez la page, la rechargez ou revenez en
        arrière jusqu&apos;à quitter le site, l&apos;analyse est définitivement supprimée. Notez les conseils
        qui vous sont utiles.
      </p>
    </NoStorageWarning>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{label}</p>
      {value ? (
        <p className="text-sm leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">Non trouvé dans le CV</p>
      )}
    </div>
  );
}

// CV affiché en grand, en entier (sans recadrage) ; un clic l'ouvre en plein écran.
function ZoomableCv({ src, alt, title }: { src: string; alt: string; title: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border bg-white"
          aria-label={`Agrandir : ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée (data URL) ou statique, affichée telle quelle */}
          <img src={src} alt={alt} className="block h-auto w-full" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
        <img src={src} alt={alt} className="block h-auto w-full rounded-lg border border-border" />
      </DialogContent>
    </Dialog>
  );
}
