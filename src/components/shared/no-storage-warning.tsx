import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

// Encadré rouge affiché en haut des deux outils : rien n'est enregistré,
// une fausse manipulation (fermer, recharger, quitter le site) efface tout.
// Lien vers la page Confidentialité, ouvert dans un nouvel onglet pour ne
// pas perdre la simulation ou l'analyse en cours.
export function PrivacyLink() {
  return (
    <a href="/confidentialite" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
      En savoir plus
    </a>
  );
}

export function NoStorageWarning({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border-2 border-destructive/40 bg-destructive/10 text-destructive",
        compact ? "px-3 py-1.5 text-xs sm:text-sm" : "px-4 py-3 text-sm"
      )}
    >
      <TriangleAlert className={cn("shrink-0", compact ? "mt-0.5 size-4" : "mt-0.5 size-5")} />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
