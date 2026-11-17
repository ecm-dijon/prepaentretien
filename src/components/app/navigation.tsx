"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Une seule page : l'accueil et les deux outils restent montés en mémoire
// (rien n'est stocké nulle part), on passe de l'un à l'autre sans recharger.
// L'ancre de l'adresse (#entretien, #cv) suit l'outil ouvert pour que le
// bouton « retour » du navigateur ramène à l'accueil.
export type Mode = "home" | "entretien" | "cv";

const NavigationContext = createContext<{ mode: Mode; open: (mode: Mode) => void } | null>(null);

function modeFromHash(): Mode {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash.replace("#", "");
  return hash === "entretien" || hash === "cv" ? hash : "home";
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("home");

  useEffect(() => {
    setMode(modeFromHash());
    const onChange = () => setMode(modeFromHash());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  const open = useCallback((next: Mode) => {
    const hash = next === "home" ? "" : `#${next}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", `${window.location.pathname}${hash}`);
    }
    setMode(next);
    window.scrollTo({ top: 0 });
  }, []);

  return <NavigationContext.Provider value={{ mode, open }}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  return useContext(NavigationContext);
}
