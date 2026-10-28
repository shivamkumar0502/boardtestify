import { NativeSeries } from "../src/series";
import { useEffect, useState, useRef } from "react";
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
import {
  NativeLanguageSwitch,
  NativeAnnouncements,
  NativeResources,
  NativePhone,
  NativeBilling,
  NativeAccountEditor,
  NativePasswordRecovery,
} from "../src/extras";
import { getLanguage, tr, useLanguage } from "@boardtestify/i18n";
import { s, Button, ErrorText } from "../src/ui";
export default function Home() {
  useLanguage();
  const router = useRouter();
  const loadVersion = useRef(0);
  const [showOtp, setShowOtp] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
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
    [seriesVersion, setSeriesVersion] = useState(0),
    [attempts, setAttempts] = useState([]);
  useEffect(() => {
    restore()
      .then(setSigned)
      .finally(() => setReady(true));
  }, []);
  const load = useCallback(async () => {
    if (!signed) return;
    const version = ++loadVersion.current;
    const scope = `${user?.id}:${user?.classLevel}:${user?.stream}`;
    setSeriesVersion((n) => n + 1);
    try {
      const a = await api("/attempts");
      if (
        version === loadVersion.current &&
        scope === `${user?.id}:${user?.classLevel}:${user?.stream}`
      )
        setAttempts(a);
    } catch (e) {
      if (version === loadVersion.current) setError(e.message);
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
        await register({
          name,
          email,
          password,
          classLevel: level,
          stream,
          language: getLanguage(),
        });
      else await login(email, password);
      setSigned(true);
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <SafeAreaView
        style={[
          s.screen,
          {
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator color="#ff7a35" />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <NativeLanguageSwitch />
          <Text style={s.brand}>
            {tr("B")}
            <Text style={s.accent}>{tr("\u2713")}</Text>
            {tr(" BoardTestify")}
            <Text style={s.accent}>{tr(".")}</Text>
          </Text>
          {!signed ? (
            <>
              {!signup && (
                <>
                  <Button secondary onPress={() => setShowOtp(!showOtp)}>
                    {tr("Phone OTP sign-in")}
                  </Button>
                  {showOtp && (
                    <NativePhone
                      onSuccess={() => {
                        setSigned(true);
                        setPassword("");
                      }}
                    />
                  )}
                </>
              )}
              <Text style={s.eyebrow}>
                {tr("YOUR NEXT CHAPTER STARTS HERE")}
              </Text>
              <Text style={s.h1}>
                {signup ? tr("Make preparation yours.") : tr("Welcome back.")}
              </Text>
              <Text
                style={[
                  s.muted,
                  {
                    marginBottom: 30,
                  },
                ]}
              >
                {tr(
                  "Bihar Board Class 10 & 12. Practice Smart. Prepare Better. Score Higher.",
                )}
              </Text>
              {signup && (
                <>
                  <Text style={s.label}>{tr("Full name")}</Text>
                  <TextInput
                    accessibilityLabel={tr("Full name")}
                    style={s.input}
                    value={name}
                    onChangeText={setName}
                  />
                </>
              )}
              <Text style={s.label}>{tr("Email address")}</Text>
              <TextInput
                accessibilityLabel={tr("Email address")}
                style={s.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={s.label}>
                {tr("Password \xB7 at least 10 characters")}
              </Text>
              <TextInput
                accessibilityLabel={tr("Password")}
                style={s.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {signup && (
                <>
                  <Text style={s.label}>{tr("Class")}</Text>
                  <View style={s.tabs}>
                    {tr(
                      ["10", "12"].map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[s.tab, level === v && s.tabActive]}
                          onPress={() => {
                            setLevel(v);
                            setStream(v === "10" ? "GENERAL" : "SCIENCE");
                          }}
                        >
                          <Text style={s.text}>
                            {tr("Class ")}
                            {tr(v)}
                          </Text>
                        </TouchableOpacity>
                      )),
                    )}
                  </View>
                  {level === "12" && (
                    <View style={s.tabs}>
                      {tr(
                        ["SCIENCE", "ARTS", "COMMERCE"].map((v) => (
                          <TouchableOpacity
                            style={[s.tab, stream === v && s.tabActive]}
                            key={v}
                            onPress={() => setStream(v)}
                          >
                            <Text style={s.text}>{tr(v)}</Text>
                          </TouchableOpacity>
                        )),
                      )}
                    </View>
                  )}
                </>
              )}
              <ErrorText message={error} />
              <Button disabled={busy} onPress={submit}>
                {busy
                  ? tr("Please wait…")
                  : signup
                    ? tr("Create account →")
                    : tr("Sign in →")}
              </Button>
              {!signup && (
                <>
                  <Button
                    secondary
                    onPress={() => setShowRecovery(!showRecovery)}
                  >
                    {tr("Forgot password?")}
                  </Button>
                  {showRecovery && <NativePasswordRecovery />}
                </>
              )}
              <Button
                secondary
                onPress={() => {
                  setSignup(!signup);
                  setError("");
                }}
              >
                {signup
                  ? tr("Already registered? Sign in")
                  : tr("New here? Create an account")}
              </Button>
            </>
          ) : (
            <>
              <Text style={s.eyebrow}>{tr("YOUR JOURNEY, YOUR PACE")}</Text>
              <Text style={s.h1}>
                {tr("Keep going, ")}
                {tr(user?.name?.split(" ")[0])}
                <Text style={s.accent}>{tr(".")}</Text>
              </Text>
              <Text style={s.muted}>
                {tr("Class ")}
                {tr(user?.classLevel)}
                {tr(" \xB7 ")}
                {tr(user?.stream)}
                {tr(" \xB7 Bihar Board")}
              </Text>
              <View style={s.tabs}>
                {tr(
                  ["Tests", "Attempts", "Resources", "Profile"].map((t) => (
                    <TouchableOpacity
                      style={[s.tab, tab === t && s.tabActive]}
                      onPress={() => setTab(t)}
                      key={t}
                    >
                      <Text style={s.text}>{tr(t)}</Text>
                    </TouchableOpacity>
                  )),
                )}
              </View>
              <ErrorText message={error} />
              {tab === "Tests" ? (
                <>
                  <NativeAnnouncements />
                  <NativeSeries
                    key={`${user?.classLevel}:${user?.stream}`}
                    refreshKey={seriesVersion}
                    onProfile={() => setTab("Profile")}
                  />
                </>
              ) : tab === "Attempts" ? (
                attempts.length ? (
                  tr(
                    attempts.map((a) => (
                      <View style={s.card} key={a.id}>
                        <Text style={s.small}>
                          {tr(a.status)}
                          {tr(" \xB7 ")}
                          {a.evaluationState || tr("IN PROGRESS")}
                        </Text>
                        <Text style={s.h2}>{tr(a.title)}</Text>
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
                          {a.status === "ACTIVE"
                            ? tr("Resume test")
                            : tr("View result")}
                        </Button>
                      </View>
                    )),
                  )
                ) : (
                  <Text style={s.muted}>
                    {tr("Your attempts will appear here.")}
                  </Text>
                )
              ) : tab === "Resources" ? (
                <NativeResources />
              ) : (
                <View style={s.card}>
                  <NativeAccountEditor onSaved={() => void load()} />
                  <NativeBilling />
                  <NativePhone link />
                  <Text style={s.h2}>{tr(user?.name)}</Text>
                  <Text style={s.text}>{tr(user?.email)}</Text>
                  <Text style={s.muted}>
                    {tr("Class ")}
                    {tr(user?.classLevel)}
                    {tr(" \xB7 ")}
                    {tr(user?.stream)}
                  </Text>
                  <Text
                    style={[
                      s.muted,
                      {
                        marginVertical: 20,
                      },
                    ]}
                  >
                    {tr(
                      "Use the website for study pass checkout and administration.",
                    )}
                  </Text>
                  <Button
                    secondary
                    onPress={async () => {
                      loadVersion.current++;
                      await logout();
                      setSigned(false);
                      setSeriesVersion(0);
                      setAttempts([]);
                    }}
                  >
                    {tr("Sign out")}
                  </Button>
                </View>
              )}
              <Button secondary onPress={() => void load()}>
                {tr("Refresh")}
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
