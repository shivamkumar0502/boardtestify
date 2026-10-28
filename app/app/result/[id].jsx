import { tr, useLanguage } from "@boardtestify/i18n";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/api";
import { NativeAttachment } from "../../src/extras";
import { s, Button, ErrorText } from "../../src/ui";
export default function Result() {
  useLanguage();
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
    async function retry(filter) {
      try {
        const a = await api(`/attempts/${id}/retry`, {
          filter,
          feedbackMode: "IMMEDIATE",
        });
        router.replace(`/exam/${a.id}`);
      } catch (e) {
        setError(e.message);
      }
    }
    return () => clearInterval(timer);
  }, [id]);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <ErrorText message={error} />
      {r ? (
        <>
          <Text style={s.eyebrow}>
            {r.provisional ? tr("PROVISIONAL RESULT") : tr("FINAL RESULT")}
          </Text>
          <Text style={s.h1}>{tr(r.title)}</Text>
          <Text
            style={[
              s.accent,
              {
                fontSize: 56,
                fontWeight: "700",
                marginVertical: 20,
              },
            ]}
          >
            {tr(r.awardedMarks)}
            {tr(" / ")}
            {tr(r.maximumMarks)}
          </Text>
          <Text
            style={[
              s.muted,
              {
                marginBottom: 25,
              },
            ]}
          >
            {r.provisional
              ? tr(
                  "Descriptive marks are pending AI or manual review and excluded from this total.",
                )
              : tr("Review, reflect and improve on your next attempt.")}
          </Text>
          <Button secondary onPress={() => retry("INCORRECT")}>
            {tr("Retry incorrect questions")}
          </Button>
          <Button secondary onPress={() => retry("UNANSWERED")}>
            {tr("Retry unanswered questions")}
          </Button>
          {tr(
            r.questions.map((q, i) => {
              const e = r.evaluations[q._id],
                a = r.answers[q._id];
              return (
                <View key={q._id} style={s.card}>
                  <Text style={s.eyebrow}>
                    {tr("QUESTION ")}
                    {tr(i + 1)}
                    {tr(" \xB7")}
                    {tr(" ")}
                    {e.status === "EVALUATED"
                      ? tr("{0}/{1}", [e.awardedMarks, q.maximumMarks])
                      : tr("AWAITING REVIEW")}
                  </Text>
                  <Text style={s.h2}>{tr(q.text)}</Text>
                  <Text style={s.small}>{tr("YOUR ANSWER")}</Text>
                  <Text style={s.text}>
                    {Array.isArray(a?.value)
                      ? tr(
                          a.value
                            .map(
                              (v) =>
                                q.options.find((o) => o.id === v)?.text || v,
                            )
                            .join(", "),
                        )
                      : a?.value || tr("Unanswered")}
                  </Text>
                  <Text
                    style={[
                      s.small,
                      {
                        marginTop: 20,
                      },
                    ]}
                  >
                    {tr("REFERENCE / EXPLANATION")}
                  </Text>
                  <Text style={s.muted}>
                    {q.referenceAnswer ||
                      q.explanation ||
                      tr(
                        q.correct
                          .map(
                            (v) => q.options.find((o) => o.id === v)?.text || v,
                          )
                          .join(", "),
                      )}
                  </Text>
                  {tr(
                    e.criteria?.map((c) => (
                      <View
                        key={c.id}
                        style={{
                          marginTop: 15,
                        }}
                      >
                        <Text style={s.text}>
                          {tr(q.rubric.find((x) => x.id === c.id)?.name)}
                          {tr(" \xB7")}
                          {tr(" ")}
                          {tr(c.awardedMarks)}
                        </Text>
                        <Text style={s.muted}>{tr(c.feedback)}</Text>
                      </View>
                    )),
                  )}
                  {tr(
                    e.improvementAdvice?.map((x, j) => (
                      <Text
                        key={j}
                        style={[
                          s.muted,
                          {
                            marginTop: 10,
                          },
                        ]}
                      >
                        {tr("\u2022 ")}
                        {tr(x)}
                      </Text>
                    )),
                  )}
                </View>
              );
            }),
          )}
          <Button onPress={() => router.replace("/")}>
            {tr("Back to my learning space")}
          </Button>
        </>
      ) : (
        <Text style={s.text}>{tr("Loading your result\u2026")}</Text>
      )}
    </ScrollView>
  );
}
