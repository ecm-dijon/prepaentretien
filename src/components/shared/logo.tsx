import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const content = (
  <>
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#030208]">
      <Image src="/ecm-logo.png" alt="ECM" width={32} height={32} className="size-8" />
    </span>
    <span>
      Prépa <span className="text-primary">Entretien</span>
    </span>
  </>
);

// Avec onClick (dans l'application) : ramène à l'accueil sans recharger la
// page, pour ne rien perdre de la simulation ou de l'analyse en cours.
export function Logo({ className, onClick }: { className?: string; onClick?: () => void }) {
  const classes = cn("flex items-center gap-2 text-base font-semibold tracking-tight", className);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <Link href="/" className={classes}>
      {content}
    </Link>
  );
}
