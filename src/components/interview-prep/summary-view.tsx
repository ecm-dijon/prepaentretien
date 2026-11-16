"use client";

import {
  CheckCircle2,
  Download,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InterviewPrepSummary } from "@/lib/ai/interview-prep";
import { coachMessageToText } from "@/lib/coach-message";
import { cn } from "@/lib/utils";

import type { Message } from "./types";

// Chargement anticipé du générateur de PDF (appelé dès l'ouverture de la
// page) : si le site est redéployé pendant une simulation, ces fichiers ne
// seraient plus disponibles au moment de télécharger.
export function preloadPdfModules() {
  return Promise.all([import("@react-pdf/renderer"), import("./summary-pdf")]);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function SummaryView({
  summary,
  messages,
  studentName,
  retrying,
  onRetrySummary,
  onDownloaded,
  onNewSession,
}: {
  summary: InterviewPrepSummary | null;
  messages: Message[];
  studentName: string;
  retrying: boolean;
  onRetrySummary: () => void;
  onDownloaded: () => void;
  onNewSession: () => void;
}) {
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const target = messages.find((m) => m.role === "user")?.content ?? "";
  const withTranscript = includeTranscript || !summary;

  // Le PDF est préparé à l'avance (et refait si l'option « transcription »
  // change) : le clic sur « Télécharger » ne fait que déclencher le
  // téléchargement d'un fichier déjà prêt. Sur iPhone / Safari, un
  // téléchargement lancé après une attente n'est plus considéré comme
  // demandé par l'utilisateur et peut être bloqué.
  const [pdf, setPdf] = useState<{ url: string; key: string } | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [pendingDownload, setPendingDownload] = useState(false);
  const [showFallbackLink, setShowFallbackLink] = useState(false);
  const pdfKey = `${withTranscript}-${summary ? "s" : "n"}-${messages.length}`;
  const fileName = useRef(`compte-rendu-prepa-entretien-${new Date().toISOString().slice(0, 10)}.pdf`);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfError(false);
    (async () => {
      try {
        const [{ pdf: renderPdf }, { SummaryPdf }] = await preloadPdfModules();
        const blob = await renderPdf(
          <SummaryPdf
            summary={summary}
            studentName={studentName}
            target={target}
            date={formatDate(new Date())}
            logoSrc={`${window.location.origin}/ecm-logo.png`}
            transcript={withTranscript ? messages : null}
          />
        ).toBlob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setPdf({ url: createdUrl, key: pdfKey });
      } catch (err) {
        console.error("[summary-pdf] generation failed:", err);
        if (!cancelled) setPdfError(true);
      }
    })();
    return () => {
      cancelled = true;
      // Libéré un peu plus tard : un téléchargement en cours ne doit pas
      // être interrompu.
      if (createdUrl) {
        const url = createdUrl;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    };
  }, [pdfKey, summary, studentName, target, withTranscript, messages]);

  const ready = pdf !== null && pdf.key === pdfKey;

  function triggerDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.current;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowFallbackLink(true);
    onDownloaded();
  }

  // Si l'utilisateur a cliqué avant que le PDF soit prêt, on le télécharge
  // dès qu'il l'est (le lien de secours reste disponible si le navigateur
  // bloque ce téléchargement différé).
  useEffect(() => {
    if (pendingDownload && ready && pdf) {
      setPendingDownload(false);
      triggerDownload(pdf.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDownload, ready, pdf]);

  useEffect(() => {
    if (pendingDownload && pdfError) {
      setPendingDownload(false);
      toast.error("Impossible de générer le PDF. Réessayez.");
    }
  }, [pendingDownload, pdfError]);

  function handleDownload() {
    if (ready && pdf) {
      triggerDownload(pdf.url);
    } else if (pdfError) {
      toast.error("Impossible de générer le PDF. Réessayez.");
    } else {
      setPendingDownload(true);
    }
  }

  const downloading = pendingDownload;

  return (
    <Card className="shadow-soft">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>Compte rendu de votre session</CardTitle>
        <CardDescription>
          Téléchargez-le maintenant : rien n&apos;est conservé, il disparaîtra dès que vous quitterez la
          page ou relancerez une session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 sm:px-6">
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Compte rendu</TabsTrigger>
            <TabsTrigger value="transcript">Transcription complète</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 pt-2">
            {summary ? (
              <>
                {target && (
                  <p className="text-sm">
                    <span className="font-medium">Poste visé : </span>
                    {target}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{summary.overview}</p>
                <SummaryList title="Points forts" items={summary.strengths} icon={<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />} />
                <SummaryList title="Axes d'amélioration" items={summary.improvements} icon={<TriangleAlert className="mt-0.5 size-4 shrink-0 text-ecm-orange" />} />
                <SummaryList title="Conseils clés à retenir" items={summary.keyAdvice} icon={<Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />} />
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Le compte rendu n&apos;a pas pu être généré. Vous pouvez réessayer, ou télécharger la
                  transcription complète.
                </p>
                <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetrySummary}>
                  {retrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Réessayer
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transcript" className="max-h-[60vh] space-y-4 overflow-y-auto pt-2">
            {messages.map((message, i) => (
              <div key={i} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground"
                  )}
                >
                  {message.role === "user" ? message.content : coachMessageToText(message.content)}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTranscript || !summary}
              disabled={!summary}
              onChange={(e) => setIncludeTranscript(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Inclure la transcription dans le PDF
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
            <Button type="button" variant="outline" onClick={onNewSession}>
              <RotateCcw className="size-4" /> Nouvelle session
            </Button>
            <Button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Télécharger le PDF
            </Button>
          </div>
        </div>
        {showFallbackLink && ready && pdf && (
          <p className="text-center text-xs text-muted-foreground sm:text-right">
            Le téléchargement ne démarre pas ?{" "}
            <a
              href={pdf.url}
              download={fileName.current}
              target="_blank"
              rel="noopener"
              className="font-medium text-primary underline underline-offset-4"
              onClick={onDownloaded}
            >
              Ouvrir le PDF
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <ul className="space-y-2">
        {items.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {icon}
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
