"use client";

import { Home } from "lucide-react";

import { useNavigation } from "@/components/app/navigation";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

// Barre du haut fine, commune à l'accueil et aux deux outils.
export function AppHeader({ center, actions }: { center?: React.ReactNode; actions?: React.ReactNode }) {
  const nav = useNavigation();
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
      <Logo className="shrink-0 text-sm sm:text-base" onClick={nav ? () => nav.open("home") : undefined} />
      <div className="hidden min-w-0 flex-1 justify-center text-sm text-muted-foreground md:flex">{center}</div>
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {nav && nav.mode !== "home" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => nav.open("home")} aria-label="Accueil">
            <Home className="size-4" />
            <span className="hidden sm:inline">Accueil</span>
          </Button>
        )}
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
