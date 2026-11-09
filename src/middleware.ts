import { NextResponse, type NextRequest } from "next/server";

// Protège /stats par un mot de passe (authentification HTTP Basic du
// navigateur). Sans variable STATS_PASSWORD, la page est désactivée.
export function middleware(request: NextRequest) {
  const password = process.env.STATS_PASSWORD;
  if (!password) {
    return new NextResponse("Statistiques désactivées (STATS_PASSWORD non défini).", { status: 404 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return NextResponse.next();
    } catch {
      // en-tête invalide : on redemande le mot de passe
    }
  }

  return new NextResponse("Authentification requise.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Statistiques Prepa Entretien", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/stats", "/stats/:path*"] };
