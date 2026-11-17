import "server-only";

import { PDFiumLibrary } from "@hyzyla/pdfium";
import { PNG } from "pngjs";

// Rendu de la première page d'un PDF en PNG, côté serveur.
//
// Historique : une première version rendait le CV importé côté client via
// pdf.js (canvas). Techniquement solide (résolution vérifiée suffisante),
// mais le texte restait visiblement plus flou/crénelé que le CV type
// (rasterisé, lui, avec PyMuPDF) pour certains CV réels -- pdf.js réimplémente
// le rendu PDF en JS pur et n'obtient pas toujours la même qualité de
// rendu de police que les moteurs natifs. On utilise donc ici PDFium (le
// moteur PDF de Chrome lui-même) via son portage WebAssembly, exactement
// le même type de moteur natif que celui qui rasterise déjà le CV type
// (MuPDF) -- qualité équivalente garantie des deux côtés de la
// comparaison. PDFium est sous licence permissive (BSD-3-Clause), tout
// comme ce wrapper (@hyzyla/pdfium, MIT) : pas de contrainte type AGPL,
// contrairement à mupdf.js (la librairie officielle Artifex, écartée pour
// cette raison malgré une qualité de rendu équivalente).
export async function renderPdfFirstPageToPng(pdfBytes: Buffer, scale = 3): Promise<Buffer> {
  const library = await PDFiumLibrary.init();
  try {
    const document = await library.loadDocument(pdfBytes);
    try {
      const [firstPage] = document.pages();
      if (!firstPage) throw new Error("Le PDF ne contient aucune page.");

      const image = await firstPage.render({
        scale,
        render: async (options) => {
          const png = new PNG({ width: options.width, height: options.height });
          png.data = Buffer.from(options.data);
          return PNG.sync.write(png);
        },
      });
      return Buffer.from(image.data);
    } finally {
      document.destroy();
    }
  } finally {
    library.destroy();
  }
}
