import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { InterviewPrepSummary } from "@/lib/ai/interview-prep";
import { coachMessageToText } from "@/lib/coach-message";

import type { Message } from "./types";

// Même charte que la fiche PDF de la Plateforme des Compétences.
const ECM_BLACK = "#030208";
const ECM_BLUE = "#296daa";
const ECM_BLUE_LIGHT = "#15b8eb";

const styles = StyleSheet.create({
  page: { fontSize: 10, fontFamily: "Helvetica", color: "#171717", paddingBottom: 40 },
  headerBand: {
    backgroundColor: ECM_BLACK,
    paddingHorizontal: 36,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: { width: 34, height: 34, borderRadius: 6 },
  headerText: { flex: 1 },
  schoolName: {
    fontSize: 8,
    color: ECM_BLUE_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 3 },
  meta: { fontSize: 9, color: "#c7c9d9" },
  body: { padding: 36, paddingTop: 20 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: ECM_BLUE,
  },
  paragraph: { fontSize: 10, color: "#404040", lineHeight: 1.5 },
  bulletRow: { flexDirection: "row", marginBottom: 5 },
  bullet: { width: 12, fontSize: 10, color: ECM_BLUE },
  bulletText: { flex: 1, fontSize: 10, color: "#262626", lineHeight: 1.45 },
  turn: { marginBottom: 7 },
  turnLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#737373", marginBottom: 2 },
  turnText: { fontSize: 9, color: "#404040", lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 7.5,
    color: "#a3a3a3",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function SummaryPdf({
  summary,
  studentName,
  target,
  date,
  logoSrc,
  transcript,
}: {
  summary: InterviewPrepSummary | null;
  studentName: string;
  target: string;
  date: string;
  logoSrc: string;
  transcript: Message[] | null;
}) {
  return (
    <Document title="Compte rendu — Prépa entretien" author="ECM — Prépa Entretien">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant react-pdf, pas une balise HTML */}
          <Image src={logoSrc} style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.schoolName}>ECM — Prépa entretien</Text>
            <Text style={styles.title}>Compte rendu de simulation</Text>
            <Text style={styles.meta}>
              {[studentName, date].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {target && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Poste visé</Text>
              <Text style={styles.paragraph}>{target}</Text>
            </View>
          )}

          {summary ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Synthèse</Text>
                <Text style={styles.paragraph}>{summary.overview}</Text>
              </View>
              {summary.strengths.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Points forts</Text>
                  <Bullets items={summary.strengths} />
                </View>
              )}
              {summary.improvements.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Axes d&apos;amélioration</Text>
                  <Bullets items={summary.improvements} />
                </View>
              )}
              {summary.keyAdvice.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Conseils clés à retenir</Text>
                  <Bullets items={summary.keyAdvice} />
                </View>
              )}
            </>
          ) : (
            <Text style={styles.paragraph}>Compte rendu indisponible pour cette session.</Text>
          )}

          {transcript && transcript.length > 0 && (
            <View style={styles.section} break>
              <Text style={styles.sectionTitle}>Transcription complète</Text>
              {transcript.map((m, i) => (
                <View key={i} style={styles.turn}>
                  <Text style={styles.turnLabel}>{m.role === "user" ? "Étudiant·e" : "Coach"}</Text>
                  <Text style={styles.turnText}>
                    {m.role === "user" ? m.content : coachMessageToText(m.content)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>ECM — Prépa Entretien · document généré localement, aucune donnée conservée</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
