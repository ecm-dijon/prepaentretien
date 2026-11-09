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
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InterviewPrepSummary } from "@/lib/ai/interview-prep";
import { cn } from "@/lib/utils";

import type { Message } from "./types";

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
  const [downloading, setDownloading] = useState(false);
  const target = messages.find((m) => m.role === "user")?.content ?? "";

  async function handleDownload() {
    setDownloading(true);
    try {
      // Généré entièrement dans le navigateur : le compte rendu ne repasse
      // jamais par un serveur.
      const [{ pdf }, { SummaryPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./summary-pdf"),
      ]);
      const now = new Date();
      const blob = await pdf(
        <SummaryPdf
          summary={summary}
          studentName={studentName}
          target={target}
          date={formatDate(now)}
          logoSrc={`${window.location.origin}/ecm-logo.png`}
          transcript={includeTranscript || !summary ? messages : null}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compte-rendu-prepa-entretien-${now.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onDownloaded();
    } catch (err) {
      console.error("[summary-pdf] generation failed:", err);
      toast.error("Impossible de générer le PDF. Réessayez.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl shadow-soft">
      <CardHeader>
        <CardTitle>Compte rendu de votre session</CardTitle>
        <CardDescription>
          Téléchargez-le maintenant : rien n&apos;est conservé, il disparaîtra dès que vous quitterez la
          page ou relancerez une session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                  {message.content}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onNewSession}>
              <RotateCcw className="size-4" /> Nouvelle session
            </Button>
            <Button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Télécharger le PDF
            </Button>
          </div>
        </div>
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
