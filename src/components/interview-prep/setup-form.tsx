"use client";

import { Play, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEGREE_OPTIONS, YEAR_LEVEL_OPTIONS } from "@/lib/degree-options";

import type { StudentForm } from "./types";

export function SetupForm({
  value,
  onChange,
  onStart,
}: {
  value: StudentForm;
  onChange: (value: StudentForm) => void;
  onStart: () => void;
}) {
  const set = (field: keyof StudentForm) => (v: string) => onChange({ ...value, [field]: v });

  return (
    <Card className="mx-auto max-w-3xl shadow-soft">
      <CardHeader>
        <CardTitle>Avant de commencer</CardTitle>
        <CardDescription>
          Tout est facultatif, mais plus vous en dites, plus le coach personnalise ses questions (mises en
          situation, « pourquoi vous ? »...).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onStart();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="firstName">
              <Input
                id="firstName"
                value={value.firstName}
                onChange={(e) => set("firstName")(e.target.value)}
                maxLength={80}
                autoComplete="off"
              />
            </Field>
            <Field label="Accroche" htmlFor="headline" hint="Ex : Étudiante en Bachelor Commerce, en recherche d'alternance en business development">
              <Input
                id="headline"
                value={value.headline}
                onChange={(e) => set("headline")(e.target.value)}
                maxLength={200}
                autoComplete="off"
              />
            </Field>
            <Field label="Diplôme préparé" htmlFor="degree">
              <Select value={value.degree || undefined} onValueChange={set("degree")}>
                <SelectTrigger id="degree" className="w-full">
                  <SelectValue placeholder="Choisissez votre diplôme" />
                </SelectTrigger>
                <SelectContent>
                  {DEGREE_OPTIONS.map((degree) => (
                    <SelectItem key={degree} value={degree}>
                      {degree}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Année" htmlFor="currentYear">
              <Select value={value.currentYear || undefined} onValueChange={set("currentYear")}>
                <SelectTrigger id="currentYear" className="w-full">
                  <SelectValue placeholder="Choisissez votre année" />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_LEVEL_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Compétences" htmlFor="skills" hint="Séparées par des virgules — ex : Prospection, Négociation, Excel, Canva">
            <Textarea
              id="skills"
              value={value.skills}
              onChange={(e) => set("skills")(e.target.value)}
              rows={2}
            />
          </Field>

          <Field label="Expériences" htmlFor="experiences" hint="Une par ligne — ex : Vendeur — Decathlon (job étudiant, 2024)">
            <Textarea
              id="experiences"
              value={value.experiences}
              onChange={(e) => set("experiences")(e.target.value)}
              rows={4}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
              Rien n&apos;est enregistré : tout est effacé dès que vous quittez la page.
            </p>
            <Button type="submit">
              <Play className="size-4" /> Démarrer la simulation
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
