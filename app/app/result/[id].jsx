import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/api";
import { s, Button, ErrorText } from "../../src/ui";
export default function Result() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [r, setR] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const load = () =>
      api(`/attempts/${id}/result`)
        .then(setR)
        .catch((e) => setError(e.message));
    void load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [id]);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <ErrorText message={error} />
      {r ? (
        <>
          <Text style={s.eyebrow}>
            {r.provisional ? "PROVISIONAL RESULT" : "FINAL RESULT"}
          </Text>
          <Text style={s.h1}>{r.title}</Text>
          <Text
            style={[
              s.accent,
              { fontSize: 56, fontWeight: "700", marginVertical: 20 },
            ]}
          >
            {r.awardedMarks} / {r.maximumMarks}
          </Text>
          <Text style={[s.muted, { marginBottom: 25 }]}>
            {r.provisional
              ? "Descriptive marks are pending AI or manual review and excluded from this total."
              : "Review, reflect and improve on your next attempt."}
          </Text>
          {r.questions.map((q, i) => {
            const e = r.evaluations[q._id],
              a = r.answers[q._id];
            return (
              <View key={q._id} style={s.card}>
                <Text style={s.eyebrow}>
                  QUESTION {i + 1} ·{" "}
                  {e.status === "EVALUATED"
                    ? `${e.awardedMarks}/${q.maximumMarks}`
                    : "AWAITING REVIEW"}
                </Text>
                <Text style={s.h2}>{q.text}</Text>
                <Text style={s.small}>YOUR ANSWER</Text>
                <Text style={s.text}>
                  {Array.isArray(a?.value)
                    ? a.value
                        .map(
                          (v) => q.options.find((o) => o.id === v)?.text || v,
                        )
                        .join(", ")
                    : a?.value || "Unanswered"}
                </Text>
                <Text style={[s.small, { marginTop: 20 }]}>
                  REFERENCE / EXPLANATION
                </Text>
                <Text style={s.muted}>
                  {q.referenceAnswer ||
                    q.explanation ||
                    q.correct
                      .map((v) => q.options.find((o) => o.id === v)?.text || v)
                      .join(", ")}
                </Text>
                {e.criteria?.map((c) => (
                  <View key={c.id} style={{ marginTop: 15 }}>
                    <Text style={s.text}>
                      {q.rubric.find((x) => x.id === c.id)?.name} ·{" "}
                      {c.awardedMarks}
                    </Text>
                    <Text style={s.muted}>{c.feedback}</Text>
                  </View>
                ))}
                {e.improvementAdvice?.map((x, j) => (
                  <Text key={j} style={[s.muted, { marginTop: 10 }]}>
                    • {x}
                  </Text>
                ))}
              </View>
            );
          })}
          <Button onPress={() => router.replace("/")}>
            Back to my learning space
          </Button>
        </>
      ) : (
        <Text style={s.text}>Loading your result…</Text>
      )}
    </ScrollView>
  );
}
