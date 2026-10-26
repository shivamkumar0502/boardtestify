import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { answerStatus, hasAnswer } from "@boardtestify/domain";
import { api } from "../../src/api";
import { s, Button, ErrorText } from "../../src/ui";
export default function Exam() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [a, setA] = useState(null),
    [idx, setIdx] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Loading your attempt…"),
    [remaining, setRemaining] = useState(null),
    [showPalette, setPalette] = useState(false),
    [conflict, setConflict] = useState(false),
    [pending, setPending] = useState(0);
  const data = useRef(null),
    queue = useRef({}),
    busy = useRef(false),
    conflicted = useRef(false),
    clock = useRef({ server: 0, mono: 0 }),
    seq = useRef(0);
  const key = `bt-mobile-queue-${id}`;
  async function persist() {
    await AsyncStorage.setItem(key, JSON.stringify(queue.current));
    setPending(Object.keys(queue.current).length);
  }
  async function load() {
    const fresh = await api(`/attempts/${id}`);
    data.current = fresh;
    setA(fresh);
    clock.current = {
      server: Date.parse(fresh.serverNow),
      mono: performance.now(),
    };
    if (fresh.status !== "ACTIVE") router.replace(`/result/${id}`);
  }
  async function flush() {
    if (busy.current || conflicted.current) return false;
    busy.current = true;
    try {
      for (const [qid, snapshot] of Object.entries(queue.current)) {
        const result = await api(`/attempts/${id}/answer`, snapshot, "PUT");
        data.current.answers[qid] = result.answer;
        clock.current = {
          server: Date.parse(result.serverNow),
          mono: performance.now(),
        };
        const latest = queue.current[qid];
        if (latest?.generation === snapshot.generation)
          delete queue.current[qid];
        else if (latest) latest.version = result.answer.version;
        await persist();
        setA({ ...data.current });
      }
      setStatus("All answers saved");
      return !Object.keys(queue.current).length;
    } catch (e) {
      if (e.status === 409) {
        conflicted.current = true;
        setConflict(true);
        setError(
          "The server has a newer answer or the attempt ended. Local changes are preserved until you discard them.",
        );
      } else
        setStatus(
          "Save pending. Retrying automatically; keep this screen open.",
        );
      return false;
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw) {
          queue.current = JSON.parse(raw);
          seq.current = Math.max(
            0,
            ...Object.values(queue.current).map((v) => v.generation),
          );
          setPending(Object.keys(queue.current).length);
        }
        return load();
      })
      .then(() => setStatus("Attempt restored"))
      .catch((e) => setError(e.message));
    const saves = setInterval(() => {
      if (mounted && data.current) void flush();
    }, 3000);
    const sync = setInterval(() => {
      if (
        !busy.current &&
        !Object.keys(queue.current).length &&
        !conflicted.current
      )
        load().catch(() => {});
    }, 30000);
    const timer = setInterval(() => {
      if (data.current?.deadline)
        setRemaining(
          Math.max(
            0,
            Date.parse(data.current.deadline) -
              (clock.current.server + performance.now() - clock.current.mono),
          ),
        );
    }, 300);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !Object.keys(queue.current).length)
        load().catch(() => {});
    });
    return () => {
      mounted = false;
      clearInterval(saves);
      clearInterval(sync);
      clearInterval(timer);
      sub.remove();
    };
  }, [id]);
  useEffect(() => {
    if (remaining !== 0) return;
    api(`/attempts/${id}/submit`, {})
      .then(() => router.replace(`/result/${id}`))
      .catch((e) => setError(e.message));
  }, [remaining]);
  function change(value, review) {
    if (conflicted.current || remaining === 0) return;
    const q = data.current.questions[idx];
    const current = queue.current[q._id] || data.current.answers[q._id];
    queue.current[q._id] = {
      questionId: q._id,
      version: current?.version ?? 0,
      value,
      review: review ?? current?.review ?? false,
      visited: true,
      generation: ++seq.current,
    };
    void persist();
    setA({ ...data.current });
    setStatus("Saving…");
  }
  useEffect(() => {
    if (!a) return;
    const q = a.questions[idx];
    if (!queue.current[q._id] && !a.answers[q._id]?.visited)
      change(q.type.endsWith("CHOICE") ? [] : "");
  }, [idx, a?.id]);
  function submit() {
    Alert.alert(
      "Submit your test?",
      "Saved answers will be final. You cannot change them after submission.",
      [
        { text: "Keep reviewing", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              if (!(await flush()))
                throw Error("Save all answers before submitting.");
              await api(`/attempts/${id}/submit`, {});
              await AsyncStorage.removeItem(key);
              router.replace(`/result/${id}`);
            } catch (e) {
              setError(e.message);
            }
          },
        },
      ],
    );
  }
  if (!a)
    return (
      <View style={[s.screen, s.content]}>
        <ErrorText message={error} />
        <Text style={s.text}>{status}</Text>
      </View>
    );
  const q = a.questions[idx],
    answer = queue.current[q._id] || a.answers[q._id],
    seconds = remaining === null ? null : Math.ceil(remaining / 1000);
  const section = a.snapshot.sections.find((x) => x.id === q.sectionId);
  const paletteColors = {
    NOT_VISITED: "#222227",
    NOT_ANSWERED: "#602d24",
    ANSWERED: "#23553b",
    MARKED_FOR_REVIEW: "#553478",
    ANSWERED_AND_MARKED_FOR_REVIEW: "#553478",
  };
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.h2}>{a.snapshot.title}</Text>
        <View
          style={[s.row, { justifyContent: "space-between", marginBottom: 18 }]}
        >
          <Text style={s.timer}>
            {seconds === null
              ? "Untimed"
              : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPalette(!showPalette)}
          >
            <Text style={s.accent}>Question palette ▦</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.small}>
          {pending ? `${pending} pending answer update(s)` : status}
        </Text>
        <ErrorText message={error} />
        {conflict && (
          <Button
            secondary
            onPress={() =>
              Alert.alert(
                "Discard local changes?",
                "The saved server answers will be loaded.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: async () => {
                      queue.current = {};
                      await persist();
                      conflicted.current = false;
                      setConflict(false);
                      setError("");
                      await load();
                    },
                  },
                ],
              )
            }
          >
            Discard local changes & reload
          </Button>
        )}
        {showPalette && (
          <View style={[s.card, s.row]}>
            {a.questions.map((question, i) => (
              <TouchableOpacity
                key={question._id}
                accessibilityLabel={`Question ${i + 1} ${answerStatus(queue.current[question._id] || a.answers[question._id])}`}
                style={[
                  s.palette,
                  {
                    backgroundColor:
                      paletteColors[
                        answerStatus(
                          queue.current[question._id] ||
                            a.answers[question._id],
                        )
                      ],
                    borderColor: i === idx ? "white" : "#45454f",
                  },
                ]}
                onPress={() => {
                  setIdx(i);
                  setPalette(false);
                }}
              >
                <Text style={s.text}>
                  {i + 1}
                  {answerStatus(
                    queue.current[question._id] || a.answers[question._id],
                  ) === "ANSWERED_AND_MARKED_FOR_REVIEW"
                    ? "✓"
                    : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={[s.eyebrow, { marginTop: 20 }]}>
          QUESTION {idx + 1} / {a.questions.length} · +{q.maximumMarks} / −
          {q.negativeMarks}
        </Text>
        <Text style={s.small}>
          {section.title} · {section.instructions}
          {section.maxAnswers ? ` · Attempt up to ${section.maxAnswers}` : ""}
        </Text>
        <Text style={[s.h2, { lineHeight: 32, marginVertical: 20 }]}>
          {q.text}
        </Text>
        {q.translation && (
          <Text style={[s.muted, { marginBottom: 20 }]}>{q.translation}</Text>
        )}
        {q.imageKey && <QuestionImage attemptId={id} imageKey={q.imageKey} />}
        <View pointerEvents={conflict || remaining === 0 ? "none" : "auto"}>
          {q.type.endsWith("CHOICE") ? (
            q.options.map((o) => {
              const values = Array.isArray(answer?.value) ? answer.value : [];
              return (
                <TouchableOpacity
                  accessibilityRole={
                    q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"
                  }
                  accessibilityState={{ checked: values.includes(o.id) }}
                  style={[s.option, values.includes(o.id) && s.selected]}
                  key={o.id}
                  onPress={() =>
                    change(
                      q.type === "SINGLE_CHOICE"
                        ? [o.id]
                        : values.includes(o.id)
                          ? values.filter((v) => v !== o.id)
                          : [...values, o.id],
                    )
                  }
                >
                  <Text style={s.text}>
                    {values.includes(o.id) ? "●" : "○"} {o.text}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <>
              <Text style={s.label}>
                Your answer · Hindi or English
                {q.wordLimit ? ` · maximum ${q.wordLimit} words` : ""}
              </Text>
              <TextInput
                accessibilityLabel="Your answer"
                multiline
                style={[s.input, s.answer]}
                value={typeof answer?.value === "string" ? answer.value : ""}
                onChangeText={(value) => change(value)}
                maxLength={20000}
                placeholder="Start your answer…"
                placeholderTextColor="#72727f"
              />
            </>
          )}
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              onPress={() => change(q.type.endsWith("CHOICE") ? [] : "")}
            >
              Clear response
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              onPress={() =>
                change(
                  answer?.value || (q.type.endsWith("CHOICE") ? [] : ""),
                  !answer?.review,
                )
              }
            >
              {answer?.review ? "Unmark review" : "Mark for review"}
            </Button>
          </View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              disabled={idx === 0}
              onPress={() => setIdx(idx - 1)}
            >
              ← Previous
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={async () => {
                await flush();
                if (idx < a.questions.length - 1) setIdx(idx + 1);
                else submit();
              }}
            >
              Save & next →
            </Button>
          </View>
        </View>
        <Button secondary onPress={submit}>
          Submit examination
        </Button>
        <Text style={[s.small, { marginTop: 20 }]}>
          Time continues when you leave. Keep this screen open until answers are
          saved. Marked-for-review answers count toward your result.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function QuestionImage({ attemptId, imageKey }) {
  const [uri, setURI] = useState("");
  useEffect(() => {
    api(`/attempts/${attemptId}/image?key=${encodeURIComponent(imageKey)}`)
      .then((d) => setURI(d.url))
      .catch(() => {});
  }, [imageKey]);
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: 220, marginBottom: 20 }}
      resizeMode="contain"
      accessibilityLabel="Question diagram"
    />
  ) : null;
}
