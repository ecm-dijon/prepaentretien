# Prépa Entretien — ECM

Coach IA interne qui prépare les étudiant·e·s de l'ECM en alternance à leurs entretiens. C'est la
fonctionnalité **« Prépa entretien »** de la
[Plateforme des Compétences](https://github.com/cams1708/plateforme-des-competences)
(`/dashboard/entretien`), extraite en application autonome : **mêmes prompts, même déroulé, même
interface, même compte rendu** — mais **sans compte, sans base de données, sans aucun stockage**.

## Zéro stockage

- Pas de connexion, pas de base : la session (profil saisi + messages) vit **uniquement dans la
  mémoire de la page**. Fermer ou recharger l'onglet efface tout (un avertissement s'affiche avant).
- Le serveur est **sans état** : chaque appel reçoit l'historique de la session, le transmet à
  l'API Claude et ne garde rien — les logs serveur ne contiennent jamais le contenu des échanges.
- Pas de `localStorage` ni de cookies applicatifs.
- Le **compte rendu PDF est généré dans le navigateur** : il ne repasse par aucun serveur.
- Seules des **statistiques d'usage anonymes** sont comptées (voir plus bas) : des compteurs
  agrégés par jour, sans contenu, sans identifiant, sans adresse IP ni cookie.

## Fonctionnement

1. L'étudiant·e renseigne (facultatif) prénom, accroche, diplôme, année, compétences, expériences —
   le coach s'en sert pour personnaliser ses questions.
2. Le coach demande le poste visé (alternance par défaut), envoie les **rappels avant le jour J**,
   puis passe en mode **recruteur·se RH** et suit le script, avec un retour de coaching après chaque
   réponse (méthode STAR, pièges classiques corrigés avec exemples) :
   a. Pourquoi cette entreprise ? · b. Pourquoi ce poste ? · c. Pourquoi vous ? ·
   d. Que dirait votre ancien employeur ? · e. Axes d'amélioration ? · f. Dans 5 à 10 ans ? ·
   g. Mises en situation · h. Fin de l'entretien ? · i. Les 24h suivantes ?
3. **« Terminer la session »** : l'IA génère le compte rendu structuré (synthèse, points forts, axes
   d'amélioration, conseils clés), affiché à l'écran avec la transcription complète.
4. **« Télécharger le PDF »** (option : inclure la transcription), puis éventuellement
   **« Nouvelle session »** pour un autre poste.

Garde-fous repris de la plateforme : clé API uniquement côté serveur (Server Actions), 80 messages
max par session, 4000 caractères max par message, nettoyage du texte généré (Markdown, caractères
non français).

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 + shadcn/ui ·
API Claude (`@anthropic-ai/sdk`) · `@react-pdf/renderer` (PDF côté navigateur).

| Fichier | Rôle |
| --- | --- |
| `src/lib/ai/interview-prep.ts` | Prompt système du coach + génération du compte rendu (repris tel quel) |
| `src/lib/ai/interview-prep-checklist.ts` | Rappels « avant le jour J » |
| `src/lib/actions/interview-prep.ts` | Server Actions sans état (réponse du coach, compte rendu) |
| `src/components/interview-prep/` | Formulaire de départ, chat, compte rendu, PDF |

## Installation

```bash
cp .env.example .env.local   # renseigner ANTHROPIC_API_KEY
npm install
npm run dev
```

Seule variable nécessaire : `ANTHROPIC_API_KEY`.

## Statistiques d'usage anonymes (`/stats`)

Pour savoir si l'outil est utilisé, la page `/stats` affiche sur 7, 30 et 90 jours : simulations
démarrées, part avec profil renseigné, part où l'étudiant·e a répondu au moins une fois, réponses
envoyées, simulations terminées, durée moyenne, nombre moyen de réponses et PDF téléchargés, avec
le détail par jour. Seuls des compteurs par jour sont stockés (`prepa:stats:AAAA-MM-JJ` dans Redis).

Activation (facultative — sans ça l'application fonctionne pareil, sans statistiques) :

1. Vercel > projet > **Storage** > **Create Database** > **Upstash for Redis** (offre gratuite),
   puis **Connect** au projet : les variables `KV_REST_API_URL` / `KV_REST_API_TOKEN` sont ajoutées
   automatiquement.
2. Settings > Environment Variables : ajouter `STATS_PASSWORD` (mot de passe de la page).
3. Redéployer, puis ouvrir `https://<votre-domaine>/stats` (identifiant : n'importe lequel, mot de
   passe : `STATS_PASSWORD`).

## Déploiement

Compatible Vercel tel quel (`maxDuration = 60` pour laisser le temps à l'API Claude de répondre).
L'application étant sans connexion, toute personne ayant l'URL peut l'utiliser (et consommer des
crédits API) : pour un usage strictement interne, la placer derrière une protection d'accès
(ex : Vercel Deployment Protection / mot de passe, réseau de l'école). Les pages sont marquées
`noindex`.
