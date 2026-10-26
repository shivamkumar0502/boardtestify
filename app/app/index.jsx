import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { api, login, register, restore, logout, user } from "../src/api";
import { s, Button, ErrorText } from "../src/ui";
export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false),
    [signed, setSigned] = useState(false),
    [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [level, setLevel] = useState("10"),
    [stream, setStream] = useState("GENERAL"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Tests"),
    [tests, setTests] = useState([]),
    [attempts, setAttempts] = useState([]);
  useEffect(() => {
    restore()
      .then(setSigned)
      .finally(() => setReady(true));
  }, []);
  const load = useCallback(async () => {
    if (!signed) return;
    try {
      const [t, a] = await Promise.all([api("/tests"), api("/attempts")]);
      setTests(t);
      setAttempts(a);
    } catch (e) {
      setError(e.message);
    }
  }, [signed]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (signup)
        await register({ name, email, password, classLevel: level, stream });
      else await login(email, password);
      setSigned(true);
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function start(id) {
    setBusy(true);
    setError("");
    try {
      const a = await api(`/tests/${id}/start`, {});
      router.push(`/exam/${a.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <SafeAreaView style={[s.screen, { justifyContent: "center" }]}>
        <ActivityIndicator color="#ff7a35" />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Text style={s.brand}>
            B<Text style={s.accent}>✓</Text> BoardTestify
            <Text style={s.accent}>.</Text>
          </Text>
          {!signed ? (
            <>
              <Text style={s.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</Text>
              <Text style={s.h1}>
                {signup ? "Make preparation yours." : "Welcome back."}
              </Text>
              <Text style={[s.muted, { marginBottom: 30 }]}>
                Bihar Board Class 10 & 12. Practice Smart. Prepare Better. Score
                Higher.
              </Text>
              {signup && (
                <>
                  <Text style={s.label}>Full name</Text>
                  <TextInput
                    accessibilityLabel="Full name"
                    style={s.input}
                    value={name}
                    onChangeText={setName}
                  />
                </>
              )}
              <Text style={s.label}>Email address</Text>
              <TextInput
                accessibilityLabel="Email address"
                style={s.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={s.label}>Password · at least 10 characters</Text>
              <TextInput
                accessibilityLabel="Password"
                style={s.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {signup && (
                <>
                  <Text style={s.label}>Class</Text>
                  <View style={s.tabs}>
                    {["10", "12"].map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={[s.tab, level === v && s.tabActive]}
                        onPress={() => {
                          setLevel(v);
                          setStream(v === "10" ? "GENERAL" : "SCIENCE");
                        }}
                      >
                        <Text style={s.text}>Class {v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {level === "12" && (
                    <View style={s.tabs}>
                      {["SCIENCE", "ARTS", "COMMERCE"].map((v) => (
                        <TouchableOpacity
                          style={[s.tab, stream === v && s.tabActive]}
                          key={v}
                          onPress={() => setStream(v)}
                        >
                          <Text style={s.text}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
              <ErrorText message={error} />
              <Button disabled={busy} onPress={submit}>
                {busy
                  ? "Please wait…"
                  : signup
                    ? "Create account →"
                    : "Sign in →"}
              </Button>
              <Button
                secondary
                onPress={() => {
                  setSignup(!signup);
                  setError("");
                }}
              >
                {signup
                  ? "Already registered? Sign in"
                  : "New here? Create an account"}
              </Button>
            </>
          ) : (
            <>
              <Text style={s.eyebrow}>YOUR JOURNEY, YOUR PACE</Text>
              <Text style={s.h1}>
                Keep going, {user?.name?.split(" ")[0]}
                <Text style={s.accent}>.</Text>
              </Text>
              <Text style={s.muted}>
                Class {user?.classLevel} · {user?.stream} · Bihar Board
              </Text>
              <View style={s.tabs}>
                {["Tests", "Attempts", "Profile"].map((t) => (
                  <TouchableOpacity
                    style={[s.tab, tab === t && s.tabActive]}
                    onPress={() => setTab(t)}
                    key={t}
                  >
                    <Text style={s.text}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ErrorText message={error} />
              {tab === "Tests" ? (
                tests.length ? (
                  tests.map((t) => (
                    <View key={t.id} style={s.card}>
                      <Text style={s.eyebrow}>
                        {t.mode} · {t.premium ? "STUDY PASS" : "FREE"}
                      </Text>
                      <Text style={s.h2}>{t.title}</Text>
                      <Text style={s.muted}>{t.description}</Text>
                      <Text style={[s.small, { marginTop: 15 }]}>
                        {t.durationMinutes
                          ? `${t.durationMinutes} minutes`
                          : "Untimed"}{" "}
                        · {t.sections.reduce((n, s) => n + s.count, 0)}{" "}
                        questions
                      </Text>
                      <Button disabled={busy} onPress={() => start(t.id)}>
                        Start test ↗
                      </Button>
                    </View>
                  ))
                ) : (
                  <View style={s.card}>
                    <Text style={s.h2}>More practice is on the way.</Text>
                    <Text style={s.muted}>
                      No approved tests for this class/stream yet.
                    </Text>
                  </View>
                )
              ) : tab === "Attempts" ? (
                attempts.length ? (
                  attempts.map((a) => (
                    <View style={s.card} key={a.id}>
                      <Text style={s.small}>
                        {a.status} · {a.evaluationState || "IN PROGRESS"}
                      </Text>
                      <Text style={s.h2}>{a.title}</Text>
                      <Button
                        secondary
                        onPress={() =>
                          router.push(
                            a.status === "ACTIVE"
                              ? `/exam/${a.id}`
                              : `/result/${a.id}`,
                          )
                        }
                      >
                        {a.status === "ACTIVE" ? "Resume test" : "View result"}
                      </Button>
                    </View>
                  ))
                ) : (
                  <Text style={s.muted}>Your attempts will appear here.</Text>
                )
              ) : (
                <View style={s.card}>
                  <Text style={s.h2}>{user?.name}</Text>
                  <Text style={s.text}>{user?.email}</Text>
                  <Text style={s.muted}>
                    Class {user?.classLevel} · {user?.stream}
                  </Text>
                  <Text style={[s.muted, { marginVertical: 20 }]}>
                    Use the website for password reset, study pass checkout and
                    administration.
                  </Text>
                  <Button
                    secondary
                    onPress={async () => {
                      await logout();
                      setSigned(false);
                      setTests([]);
                      setAttempts([]);
                    }}
                  >
                    Sign out
                  </Button>
                </View>
              )}
              <Button secondary onPress={() => void load()}>
                Refresh
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
