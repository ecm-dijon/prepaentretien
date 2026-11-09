// Message d'ouverture du coach (repris de la Plateforme des Compétences, au vouvoiement).
// Généré côté navigateur : la session n'existe nulle part ailleurs.
export function openingMessage(firstName: string) {
  const name = firstName.trim();
  return `Bonjour${name ? ` ${name}` : ""} ! Je vais vous aider à vous préparer pour votre entretien d'alternance.\n\nPour commencer : quel est le poste visé ? Précisez si possible l'entreprise et le secteur, cela m'aidera à cibler mes questions. (Si c'est en fait pour un stage ou un emploi plutôt qu'une alternance, dites-le-moi et nous adapterons.)`;
}
