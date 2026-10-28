import { tr, useLanguage } from "@boardtestify/i18n";
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
import { api, uploadFile } from "../../src/api";
import * as ImagePicker from "expo-image-picker";
import { NativeAttachment } from "../../src/extras";
import { isDescriptive } from "@boardtestify/domain";
import { s, Button, ErrorText } from "../../src/ui";
export default function Exam() {
  useLanguage();
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
  const [uploading, setUploading] = useState(false),
    [readingLeft, setReadingLeft] = useState(0);
  const data = useRef(null),
    queue = useRef({}),
    busy = useRef(false),
    conflicted = useRef(false),
    clock = useRef({
      server: 0,
      mono: 0,
    }),
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
        if (result.feedback)
          data.current.feedback = {
            ...(data.current.feedback || {}),
            [qid]: result.feedback,
          };
        clock.current = {
          server: Date.parse(result.serverNow),
          mono: performance.now(),
        };
        const latest = queue.current[qid];
        if (latest?.generation === snapshot.generation)
          delete queue.current[qid];
        else if (latest) latest.version = result.answer.version;
        await persist();
        setA({
          ...data.current,
        });
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
      if (data.current?.readUntil)
        setReadingLeft(
          Math.max(
            0,
            Date.parse(data.current.readUntil) -
              (clock.current.server + performance.now() - clock.current.mono),
          ),
        );
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
  function change(value, review, attachmentIds) {
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
      attachmentIds: attachmentIds ?? current?.attachmentIds ?? [],
    };
    void persist();
    setA({
      ...data.current,
    });
    setStatus("Saving…");
  }
  useEffect(() => {
    if (!a) return;
    const q = a.questions[idx];
    if (!queue.current[q._id] && !a.answers[q._id]?.visited)
      change(q.type.endsWith("CHOICE") ? [] : "");
  }, [idx, a?.id]);
  async function pickPage(camera = false) {
    if (uploading) return;
    const question = data.current.questions[idx];
    setUploading(true);
    try {
      let picked;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw Error("Camera permission is required to photograph a page");
        picked = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      } else
        picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const uploaded = await uploadFile(
        `/attempts/${id}/sheets`,
        {
          uri: asset.uri,
          name: asset.fileName || "answer.jpg",
          type: asset.mimeType || "image/jpeg",
        },
        {
          questionId: question._id,
        },
      );
      const current =
        queue.current[question._id] || data.current.answers[question._id];
      queue.current[question._id] = {
        questionId: question._id,
        version: current?.version ?? 0,
        value: current?.value || "",
        review: current?.review ?? false,
        visited: true,
        attachmentIds: [...(current?.attachmentIds || []), uploaded.id],
        generation: ++seq.current,
      };
      await persist();
      setA({
        ...data.current,
      });
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  function submit() {
    Alert.alert(
      "Submit your test?",
      "Saved answers will be final. You cannot change them after submission.",
      [
        {
          text: "Keep reviewing",
          style: "cancel",
        },
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
        <Text style={s.text}>{tr(status)}</Text>
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
        <Text style={s.h2}>{tr(a.snapshot.title)}</Text>
        <View
          style={[
            s.row,
            {
              justifyContent: "space-between",
              marginBottom: 18,
            },
          ]}
        >
          <Text style={s.timer}>
            {seconds === null
              ? tr("Untimed")
              : tr("{0}:{1}", [
                  Math.floor(seconds / 60),
                  String(seconds % 60).padStart(2, "0"),
                ])}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPalette(!showPalette)}
          >
            <Text style={s.accent}>{tr("Question palette \u25A6")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.small}>
          {pending ? tr("{0} pending answer update(s)", [pending]) : tr(status)}
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
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
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
            {tr("Discard local changes & reload")}
          </Button>
        )}
        {showPalette && (
          <View style={[s.card, s.row]}>
            {tr(
              a.questions.map((question, i) => (
                <TouchableOpacity
                  key={question._id}
                  accessibilityLabel={tr("Question {0} {1}", [
                    i + 1,
                    answerStatus(
                      queue.current[question._id] || a.answers[question._id],
                    ),
                  ])}
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
                    {tr(i + 1)}
                    {answerStatus(
                      queue.current[question._id] || a.answers[question._id],
                    ) === "ANSWERED_AND_MARKED_FOR_REVIEW"
                      ? tr("✓")
                      : tr("")}
                  </Text>
                </TouchableOpacity>
              )),
            )}
          </View>
        )}
        <Text
          style={[
            s.eyebrow,
            {
              marginTop: 20,
            },
          ]}
        >
          {tr("QUESTION ")}
          {tr(idx + 1)}
          {tr(" / ")}
          {tr(a.questions.length)}
          {tr(" \xB7 +")}
          {tr(q.maximumMarks)}
          {tr(" / \u2212")}
          {tr(q.negativeMarks)}
        </Text>
        <Text style={s.small}>
          {tr(section.title)}
          {tr(" \xB7 ")}
          {tr(section.instructions)}
          {section.maxAnswers
            ? tr(" \xB7 Attempt up to {0}", [section.maxAnswers])
            : tr("")}
        </Text>
        <Text
          style={[
            s.h2,
            {
              lineHeight: 32,
              marginVertical: 20,
            },
          ]}
        >
          {tr(q.text)}
        </Text>
        {q.translation && (
          <Text
            style={[
              s.muted,
              {
                marginBottom: 20,
              },
            ]}
          >
            {tr(q.translation)}
          </Text>
        )}
        {q.imageKey && <QuestionImage attemptId={id} imageKey={q.imageKey} />}
        <View
          pointerEvents={
            conflict || remaining === 0 || readingLeft > 0 ? "none" : "auto"
          }
        >
          {q.type.endsWith("CHOICE") ? (
            tr(
              q.options.map((o) => {
                const values = Array.isArray(answer?.value) ? answer.value : [];
                return (
                  <TouchableOpacity
                    accessibilityRole={
                      q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"
                    }
                    accessibilityState={{
                      checked: values.includes(o.id),
                    }}
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
                      {values.includes(o.id) ? tr("●") : tr("○")} {tr(o.text)}
                    </Text>
                  </TouchableOpacity>
                );
              }),
            )
          ) : (
            <>
              <Text style={s.label}>
                {tr("Your answer \xB7 Hindi or English")}
                {q.wordLimit
                  ? tr(" \xB7 maximum {0} words", [q.wordLimit])
                  : tr("")}
              </Text>
              <TextInput
                accessibilityLabel={tr("Your answer")}
                multiline
                style={[s.input, s.answer]}
                value={typeof answer?.value === "string" ? answer.value : ""}
                onChangeText={(value) => change(value)}
                maxLength={20000}
                placeholder={tr("Start your answer…")}
                placeholderTextColor="#72727f"
              />
            </>
          )}
        </View>
        {readingLeft > 0 && (
          <Text style={s.muted}>
            {tr("Reading period \xB7 ")}
            {tr(Math.ceil(readingLeft / 60000))}
            {tr(" minute(s) remaining")}
          </Text>
        )}
        {isDescriptive(q.type) && (
          <View style={s.card}>
            <Text style={s.h2}>{tr("Handwritten answer pages")}</Text>
            <Text style={s.muted}>
              {tr(
                "Attach up to four photos, including any required diagram. Teacher review is required for image-based marks.",
              )}
            </Text>
            <Button
              secondary
              disabled={
                uploading ||
                conflict ||
                remaining === 0 ||
                readingLeft > 0 ||
                (answer?.attachmentIds?.length || 0) >= 4
              }
              onPress={() => pickPage(false)}
            >
              {uploading ? tr("Uploading…") : tr("Choose answer photo")}
            </Button>
            <Button
              secondary
              disabled={
                uploading ||
                conflict ||
                remaining === 0 ||
                readingLeft > 0 ||
                (answer?.attachmentIds?.length || 0) >= 4
              }
              onPress={() => pickPage(true)}
            >
              {tr("Photograph answer page")}
            </Button>
            {tr(
              (answer?.attachmentIds || []).map((assetId, i) => (
                <NativeAttachment
                  key={assetId}
                  id={assetId}
                  index={i}
                  remove={(assetId) =>
                    change(
                      answer?.value || "",
                      answer?.review,
                      answer.attachmentIds.filter((v) => v !== assetId),
                    )
                  }
                />
              )),
            )}
          </View>
        )}
        {a.feedback?.[q._id] && (
          <View style={s.card}>
            <Text style={s.h2}>{tr("Practice feedback")}</Text>
            <Text style={s.accent}>
              {tr(a.feedback[q._id].awardedMarks)}
              {tr(" / ")}
              {tr(q.maximumMarks)}
            </Text>
            <Text style={s.text}>
              {tr("Correct answer: ")}
              {tr(
                a.feedback[q._id].correct
                  .map((v) => q.options.find((o) => o.id === v)?.text || v)
                  .join(", "),
              )}
            </Text>
            <Text style={s.muted}>{tr(a.feedback[q._id].explanation)}</Text>
          </View>
        )}
        <View style={s.row}>
          <View
            style={{
              flex: 1,
            }}
          >
            <Button
              secondary
              onPress={() =>
                change(q.type.endsWith("CHOICE") ? [] : "", false, [])
              }
            >
              {tr("Clear response")}
            </Button>
          </View>
          <View
            style={{
              flex: 1,
            }}
          >
            <Button
              secondary
              onPress={() =>
                change(
                  answer?.value || (q.type.endsWith("CHOICE") ? [] : ""),
                  !answer?.review,
                )
              }
            >
              {answer?.review ? tr("Unmark review") : tr("Mark for review")}
            </Button>
          </View>
        </View>
        <View style={s.row}>
          <View
            style={{
              flex: 1,
            }}
          >
            <Button
              secondary
              disabled={idx === 0}
              onPress={() => setIdx(idx - 1)}
            >
              {tr("\u2190 Previous")}
            </Button>
          </View>
          <View
            style={{
              flex: 1,
            }}
          >
            <Button
              onPress={async () => {
                await flush();
                if (idx < a.questions.length - 1) setIdx(idx + 1);
                else submit();
              }}
            >
              {tr("Save & next \u2192")}
            </Button>
          </View>
        </View>
        <Button secondary disabled={uploading} onPress={submit}>
          {tr("Submit examination")}
        </Button>
        <Text
          style={[
            s.small,
            {
              marginTop: 20,
            },
          ]}
        >
          {tr(
            "Time continues when you leave. Keep this screen open until answers are saved. Marked-for-review answers count toward your result.",
          )}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function QuestionImage({ attemptId, imageKey }) {
  useLanguage();
  const [uri, setURI] = useState("");
  useEffect(() => {
    api(`/attempts/${attemptId}/image?key=${encodeURIComponent(imageKey)}`)
      .then((d) => setURI(d.url))
      .catch(() => {});
  }, [imageKey]);
  return uri ? (
    <Image
      source={{
        uri,
      }}
      style={{
        width: "100%",
        height: 220,
        marginBottom: 20,
      }}
      resizeMode="contain"
      accessibilityLabel={tr("Question diagram")}
    />
  ) : null;
}
