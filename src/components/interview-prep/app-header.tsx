import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Barre du haut fine, commune aux trois étapes (départ, chat, compte rendu).
export function AppHeader({ center, actions }: { center?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Logo className="shrink-0" />
      <div className="hidden min-w-0 flex-1 justify-center text-sm text-muted-foreground md:flex">{center}</div>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
