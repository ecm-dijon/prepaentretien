import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Confidentialité" };

// Points à faire valider par l'école / le DPO : surlignés à l'écran.
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-200/60 px-1 py-0.5 font-medium text-amber-950 dark:bg-amber-400/20 dark:text-amber-200">
      {children}
    </mark>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border/60 px-3 sm:px-6">
        <Logo className="text-sm sm:text-base" />
        <ThemeToggle />
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Confidentialité</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dernière mise à jour : <Placeholder>[À COMPLÉTER — date de validation par le DPO]</Placeholder>
          </p>

          <div className="mt-8 rounded-xl border-2 border-emerald-600/30 bg-emerald-600/[0.06] p-5 text-sm leading-relaxed">
            <p className="font-semibold text-foreground">En bref</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Aucun compte, aucune inscription.</li>
              <li>
                L&apos;ECM ne conserve <strong className="text-foreground">rien</strong> : ni vos réponses, ni
                votre CV, ni vos comptes rendus. Tout disparaît quand vous fermez la page.
              </li>
              <li>
                Pour fonctionner, vos réponses et votre CV sont transmis à un service d&apos;intelligence
                artificielle (Anthropic, États-Unis), uniquement le temps de générer la réponse.
              </li>
              <li>Seules des statistiques anonymes sont comptées (nombre de simulations, de CV analysés…).</li>
            </ul>
          </div>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
            <Section title="1. Qui sommes-nous ?">
              <p>
                Cet outil est édité par SAS ECM — École de Commerce et Management, dont le siège est situé 6 rue
                Alfred de Vigny, 25000 Besançon. Il est réservé à l&apos;accompagnement des étudiant·e·s de
                l&apos;ECM dans leur recherche de stage ou d&apos;alternance. Pour toute question relative à vos
                données personnelles :{" "}
                <a href="mailto:celharrami@ecm-france.fr" className="text-primary underline underline-offset-4">
                  celharrami@ecm-france.fr
                </a>{" "}
                <Placeholder>[À CONFIRMER — ou adresse du DPO / référent RGPD]</Placeholder>.
              </p>
            </Section>

            <Section title="2. Quelles données sont traitées, et pourquoi ?">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Outil</th>
                      <th className="px-3 py-2 font-medium">Données</th>
                      <th className="px-3 py-2 font-medium">Finalité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-3 py-2 align-top text-foreground">Préparer un entretien</td>
                      <td className="px-3 py-2 align-top">
                        Ce que vous saisissez, tout étant facultatif : prénom, accroche, diplôme et année,
                        compétences, expériences ; le poste visé et vos réponses aux questions du recruteur.
                      </td>
                      <td className="px-3 py-2 align-top">
                        Simuler un entretien, vous donner un retour après chaque réponse et un compte rendu final.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 align-top text-foreground">Analyser mon CV</td>
                      <td className="px-3 py-2 align-top">
                        Le CV que vous déposez (PDF), avec les informations qu&apos;il contient (nom, photo,
                        coordonnées, parcours…), et, si vous les indiquez, votre diplôme et votre année.
                      </td>
                      <td className="px-3 py-2 align-top">
                        Comparer votre CV au CV type de l&apos;ECM et vous donner des pistes d&apos;amélioration.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 align-top text-foreground">Dictée vocale (facultative)</td>
                      <td className="px-3 py-2 align-top">Votre voix, le temps de la transcrire en texte.</td>
                      <td className="px-3 py-2 align-top">Vous permettre de répondre à l&apos;oral.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Conseil : vos coordonnées (téléphone, adresse, email) ne sont pas utiles à l&apos;analyse de votre
                CV. Vous pouvez les retirer avant de le déposer.
              </p>
            </Section>

            <Section title="3. Qu'est-ce qui est conservé ?">
              <p>
                <strong className="text-foreground">Rien, du côté de l&apos;ECM.</strong> L&apos;outil n&apos;a ni
                compte, ni base de données des utilisateurs. Votre simulation et votre analyse de CV n&apos;existent
                que dans la page ouverte dans votre navigateur : elles sont effacées dès que vous la fermez, la
                rechargez ou quittez le site. Le CV n&apos;est jamais enregistré : il est transmis au serveur
                uniquement le temps de l&apos;analyse. Le compte rendu PDF est fabriqué directement dans votre
                navigateur et n&apos;existe que sur votre appareil si vous le téléchargez.
              </p>
              <p>Seuls sont conservés :</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  des <strong className="text-foreground">statistiques anonymes</strong> d&apos;utilisation
                  (nombre de simulations démarrées et terminées, durée, nombre de réponses, de PDF téléchargés et
                  de CV analysés), sans aucun contenu, nom ni identifiant permettant de vous reconnaître,
                  conservées 90 jours pour le détail par simulation ;
                </li>
                <li>
                  les <strong className="text-foreground">journaux techniques</strong> de l&apos;hébergeur
                  (Vercel), qui ne contiennent aucun contenu de vos échanges ni de votre CV, mais peuvent contenir
                  des données de connexion comme l&apos;adresse IP, pendant une durée limitée{" "}
                  <Placeholder>[À CONFIRMER — durée de conservation des journaux Vercel]</Placeholder>.
                </li>
              </ul>
            </Section>

            <Section title="4. Qui reçoit vos données ?">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-foreground">Anthropic</strong> (fournisseur du modèle d&apos;intelligence
                  artificielle Claude, États-Unis) reçoit vos réponses, les informations que vous saisissez et
                  votre CV, uniquement pour générer les réponses du coach, le compte rendu et l&apos;analyse du CV.
                  Anthropic n&apos;utilise pas ces données pour entraîner ses modèles et ne les conserve que
                  temporairement, selon ses conditions{" "}
                  <Placeholder>[À CONFIRMER — durée de conservation applicable au compte API de l&apos;ECM]</Placeholder>.
                </li>
                <li>
                  <strong className="text-foreground">Vercel</strong> héberge le site : vos données transitent par
                  ses serveurs le temps du traitement{" "}
                  <Placeholder>[À CONFIRMER — région d&apos;hébergement des fonctions]</Placeholder>.
                </li>
                <li>
                  <strong className="text-foreground">Upstash</strong> héberge les statistiques anonymes (aucune
                  donnée personnelle).
                </li>
                <li>
                  Si vous utilisez la <strong className="text-foreground">dictée vocale</strong>, votre navigateur
                  transmet votre voix à son propre service de reconnaissance (Google pour Chrome, Microsoft pour
                  Edge, Apple pour Safari) : c&apos;est le fonctionnement du navigateur, l&apos;ECM ne reçoit pas
                  l&apos;audio. La lecture à voix haute des questions se fait, elle, sur votre appareil.
                </li>
              </ul>
              <p>
                Vos données ne sont ni vendues ni partagées à des fins commerciales ou publicitaires.
              </p>
            </Section>

            <Section title="5. Transfert hors de l'Union européenne">
              <p>
                Anthropic étant situé aux États-Unis, l&apos;utilisation de l&apos;outil implique un transfert de
                données hors de l&apos;Union européenne, encadré par{" "}
                <Placeholder>
                  [À CONFIRMER — accord de traitement des données (DPA) d&apos;Anthropic et clauses contractuelles
                  types de la Commission européenne, acceptés par l&apos;ECM]
                </Placeholder>
                .
              </p>
            </Section>

            <Section title="6. Base légale">
              <p>
                Le traitement repose sur{" "}
                <Placeholder>
                  [À CONFIRMER — ex. l&apos;intérêt légitime de l&apos;ECM à accompagner ses étudiant·e·s dans leur
                  insertion professionnelle]
                </Placeholder>
                . L&apos;utilisation de l&apos;outil est entièrement facultative.
              </p>
            </Section>

            <Section title="7. Vos droits">
              <p>
                Conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et
                Libertés, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
                limitation et d&apos;opposition. L&apos;ECM ne conservant aucune donnée vous concernant, elle ne
                pourra généralement pas vous en communiquer ; vous pouvez néanmoins poser toute question à{" "}
                <a href="mailto:celharrami@ecm-france.fr" className="text-primary underline underline-offset-4">
                  celharrami@ecm-france.fr
                </a>
                .
              </p>
              <p>
                Vous pouvez également introduire une réclamation auprès de la CNIL (
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  www.cnil.fr
                </a>
                ).
              </p>
            </Section>

            <Section title="8. Cookies et stockage dans le navigateur">
              <p>
                Le site ne dépose aucun cookie de mesure d&apos;audience ni de publicité, et n&apos;enregistre
                rien de vos simulations ou de votre CV dans votre navigateur. Seule votre préférence
                d&apos;affichage (thème clair ou sombre) y est mémorisée, si vous la modifiez.
              </p>
            </Section>

            <Section title="9. Sécurité">
              <p>
                Les échanges avec le site et avec le service d&apos;intelligence artificielle sont chiffrés
                (HTTPS). La clé d&apos;accès au service d&apos;IA n&apos;est jamais transmise à votre navigateur.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        © ECM — École de Commerce et Management
      </footer>
    </div>
  );
}
