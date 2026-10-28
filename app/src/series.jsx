import { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { tr, useLanguage } from "@boardtestify/i18n";
import { api } from "./api";
import { s, Button, ErrorText } from "./ui";
import { NativeSeriesModel, initialSeriesState } from "./series-model";
function Chips({ options, value, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginVertical: 10 }}
      contentContainerStyle={{ gap: 8 }}
    >
      {options.map(([key, label]) => (
        <TouchableOpacity
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: key === value }}
          onPress={() => onChange(key)}
          style={[s.tab, key === value && s.tabActive]}
        >
          <Text style={s.text}>{tr(label)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
export function NativeSeries({ refreshKey = 0, onProfile }) {
  useLanguage();
  const router = useRouter();
  const [state, setState] = useState(initialSeriesState),
    modelRef = useRef(null);
  if (!modelRef.current)
    modelRef.current = new NativeSeriesModel(api, setState);
  const model = modelRef.current;
  const [query, setQuery] = useState(""),
    [subjectQuery, setSubjectQuery] = useState(""),
    [session, setSession] = useState("");
  const [showPaper, setShowPaper] = useState(false);
  useEffect(() => {
    void model.refresh();
  }, [refreshKey]);
  useEffect(() => () => model.dispose(), []);
  const filters = state.filters;
  return (
    <>
      <Text style={s.h2}>
        {tr(state.selected?.title || "BSEB test series")}
      </Text>
      <ErrorText message={state.error} />
      {!state.selected ? (
        <>
          <TextInput
            style={s.input}
            placeholderTextColor="#888"
            accessibilityLabel={tr("Search subjects")}
            placeholder={tr("Search subjects…")}
            value={subjectQuery}
            onChangeText={setSubjectQuery}
          />
          <Chips
            options={[
              ["", "All sessions"],
              ...[...new Set(state.groups.map((g) => g.session))].map((v) => [
                v,
                v,
              ]),
            ]}
            value={session}
            onChange={setSession}
          />
          {state.groups
            .filter(
              (g) =>
                (!session || g.session === session) &&
                g.title.toLowerCase().includes(subjectQuery.toLowerCase()),
            )
            .map((g) => (
              <View key={g.id} style={s.card}>
                <Text style={s.eyebrow}>
                  {g.session} · {tr("Class {0}", [g.classLevel])}
                </Text>
                <Text style={s.h2}>{tr(g.title)}</Text>
                <Text style={s.text}>
                  {tr("{0} tests · {1} free", [g.testCount, g.freeTests])}
                </Text>
                {g.reference?.theoryMarks != null && (
                  <Text style={s.muted}>
                    {tr("{0} theory marks · 2026 reference", [
                      g.reference.theoryMarks,
                    ])}
                  </Text>
                )}
                {!g.testCount && (
                  <Text style={s.muted}>
                    {tr("Tests are being prepared. No published test yet.")}
                  </Text>
                )}
                <Button
                  onPress={() => {
                    setQuery("");
                    setShowPaper(false);
                    void model.select(g);
                  }}
                >
                  {tr("View tests")}
                </Button>
              </View>
            ))}
          {!state.loading && !state.groups.length && (
            <Text style={s.muted}>
              {tr("No approved tests for this class/stream yet.")}
            </Text>
          )}
        </>
      ) : (
        <>
          <Button secondary onPress={() => model.back()}>
            {tr("← All test series")}
          </Button>
          <Text style={s.muted}>
            {state.selected.session} ·{" "}
            {tr("{0} tests · {1} free", [
              state.selected.testCount,
              state.selected.freeTests,
            ])}
          </Text>
          <Chips
            options={[
              ["", "All tests"],
              ["FULL_MOCK", "Full mocks"],
              ["CHAPTER", "Chapter tests"],
              ["TOPIC", "Topic tests"],
              ["SUBJECT", "Subject practice"],
            ]}
            value={filters.kind || ""}
            onChange={(v) => void model.filter("kind", v)}
          />
          <Chips
            options={[
              ["", "Free and premium"],
              ["FREE", "Free practice"],
              ["PREMIUM", "Study pass"],
            ]}
            value={filters.access || ""}
            onChange={(v) => void model.filter("access", v)}
          />
          {filters.kind !== "FULL_MOCK" && (
            <Chips
              options={[
                ["", "All modes"],
                ["PRACTICE", "Practice"],
                ["CBT", "CBT mocks"],
                ...(!filters.kind ? [["BOARD", "Board mocks"]] : []),
              ]}
              value={filters.mode || ""}
              onChange={(v) => void model.filter("mode", v)}
            />
          )}
          {!!state.chapters.length && (
            <Chips
              options={[
                ["", "All chapters"],
                ...state.chapters.map((c) => [c.id, c.title]),
              ]}
              value={filters.chapterId || ""}
              onChange={(v) => void model.filter("chapterId", v)}
            />
          )}
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            maxLength={80}
            placeholder={tr("Search tests…")}
            accessibilityLabel={tr("Search tests")}
            placeholderTextColor="#888"
            returnKeyType="search"
            onSubmitEditing={() => void model.filter("q", query.trim())}
          />
          <Button
            secondary
            onPress={() => void model.filter("q", query.trim())}
          >
            {tr("Search tests")}
          </Button>
          {state.paper && (
            <View style={s.card}>
              <Button secondary onPress={() => setShowPaper(!showPaper)}>
                {tr("Paper pattern & marks")}
              </Button>
              {showPaper && (
                <>
                  <Text style={s.text}>
                    {tr(state.paper.label)} · {state.paper.theoryMarks ?? "—"}{" "}
                    {tr("theory marks")}
                  </Text>
                  {state.paper.durationMinutes != null && (
                    <Text style={s.muted}>
                      {tr("Writing time")}:{" "}
                      {state.paper.durationMinutes -
                        (state.paper.readingMinutes || 0)}{" "}
                      + {state.paper.readingMinutes || 0} {tr("min reading")}
                    </Text>
                  )}
                  {state.paper.sections.map((p) => (
                    <Text key={p.id} style={s.text}>
                      {tr(p.title)}: {p.answerCount}/{p.offered} × {p.marksEach}
                    </Text>
                  ))}
                  <Text style={s.muted}>
                    {tr("practical/internal marks separate")}
                  </Text>
                  {state.paper.sourceUrl && (
                    <Button
                      secondary
                      onPress={() =>
                        Linking.openURL(state.paper.sourceUrl).catch((e) =>
                          model.emit({ error: e.message }),
                        )
                      }
                    >
                      {tr("Read official model paper")}
                    </Button>
                  )}
                </>
              )}
            </View>
          )}
          {state.rows.map((t) => (
            <View style={s.card} key={t.id}>
              <Text style={s.eyebrow}>
                {tr(t.category)} ·{" "}
                {t.premium ? tr("Study pass") : tr("Free practice")}
              </Text>
              <Text style={s.h2}>{tr(t.title)}</Text>
              <Text style={s.muted}>{tr(t.description)}</Text>
              <Text style={s.text}>
                {tr("{0} questions", [t.questions])} ·{" "}
                {t.durationMinutes
                  ? tr("{0} min", [t.durationMinutes])
                  : tr("Untimed")}
              </Text>
              {t.premium &&
              state.billingKnown &&
              !state.entitlement &&
              !t.activeAttemptId ? (
                <Button onPress={onProfile}>{tr("Get study pass")}</Button>
              ) : (
                <Button
                  disabled={state.busy}
                  onPress={() =>
                    void model.start(t, (path) => router.push(path))
                  }
                >
                  {tr(t.activeAttemptId ? "Resume test" : "Start test")}
                </Button>
              )}
              {t.resultAttemptId && (
                <Button
                  secondary
                  onPress={() => router.push(`/result/${t.resultAttemptId}`)}
                >
                  {tr("View result")}
                </Button>
              )}
            </View>
          ))}
          {state.nextCursor && (
            <Button
              secondary
              disabled={state.loading}
              onPress={() => void model.more()}
            >
              {tr("Load more tests")}
            </Button>
          )}
          {!state.loading && !state.rows.length && (
            <Text style={s.muted}>{tr("No tests match your filters")}</Text>
          )}
        </>
      )}
      {state.loading && (
        <ActivityIndicator
          accessibilityLabel={tr("Loading available tests…")}
          color="#ff7a35"
        />
      )}
    </>
  );
}
