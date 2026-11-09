// Rappels pratiques envoyés une fois, juste après la toute première réponse
// de l'étudiant·e (poste/entreprise visés) et juste avant que la simulation
// ne démarre réellement. Message statique (pas besoin de l'IA pour ça),
// volontairement court et sous forme de liste à tirets pour rester lisible
// en un coup d'œil. Exporté séparément de src/lib/actions/interview-prep.ts
// (qui a la directive "use server" et ne peut donc exporter que des
// fonctions async) pour pouvoir être comparé tel quel côté client (voir
// interview-prep-chat.tsx) et ainsi ne pas lui appliquer le rappel "prends
// des notes", qui ne doit apparaître qu'après une vraie réponse de coaching.
export const PRE_INTERVIEW_CHECKLIST_MESSAGE = `Quelques rappels avant le jour J :
- Tenue correcte et repassée, adaptée au secteur visé
- Arrivez 10 à 15 minutes en avance, pas plus
- Renseignez-vous en détail sur l'entreprise : qui est le/la dirigeant·e, son évolution sur les 10 dernières années, son chiffre d'affaires actuel, son nombre de salariés, son secteur d'activité, ses produits/services phares, ses valeurs et sa culture, son actualité récente (site, presse, réseaux sociaux), ses principaux concurrents
- Préparez 2-3 questions à poser au recruteur
- Apportez votre CV imprimé
- Téléphone en silencieux et rangé

Commençons !`.trim();
