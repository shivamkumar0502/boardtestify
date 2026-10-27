import { useState, useEffect } from "react";
import {
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLanguage, setLanguage, useLanguage, tr } from "@boardtestify/i18n";
import { api, saveSession, user, updateProfile } from "./api";
import { s, Button, ErrorText } from "./ui";
export function NativeLanguageSwitch() {
  const lang = useLanguage();
  return (
    <TouchableOpacity
      accessibilityLabel={tr("Change language")}
      accessibilityRole="button"
      onPress={() => {
        const v = lang === "hi" ? "en" : "hi";
        setLanguage(v);
        AsyncStorage.setItem("bt-lang", v).catch(() => {});
      }}
    >
      <Text
        style={[
          s.accent,
          {
            fontWeight: "600",
            padding: 10,
          },
        ]}
      >
        {lang === "hi" ? tr("English") : tr("हिन्दी")}
      </Text>
    </TouchableOpacity>
  );
}
export function NativeAnnouncements() {
  useLanguage();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api("/announcements")
      .then(setRows)
      .catch(() => {});
  }, []);
  return rows.map((r) => (
    <View style={s.card} key={r._id}>
      <Text style={s.h2}>{tr(r.title)}</Text>
      <Text style={s.text}>{tr(r.body)}</Text>
    </View>
  ));
}
export function NativeResources() {
  useLanguage();
  const [rows, setRows] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/resources")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <Text style={s.h2}>{tr("Official study references")}</Text>
      <Text
        style={[
          s.muted,
          {
            marginBottom: 20,
          },
        ]}
      >
        {tr(
          "Check the examination year; historical model papers do not establish the next session\u2019s rules.",
        )}
      </Text>
      <ErrorText message={error} />
      {tr(
        rows.map((r) => (
          <View style={s.card} key={r._id}>
            <Text style={s.eyebrow}>
              {tr("BSEB \xB7 ")}
              {tr(r.examYear)}
            </Text>
            <Text style={s.h2}>{tr(r.title)}</Text>
            <Text style={s.muted}>{tr(r.note)}</Text>
            <Button
              secondary
              onPress={() =>
                Linking.openURL(r.url).catch(() =>
                  setError("Unable to open reference"),
                )
              }
            >
              {tr("Open official reference \u2197")}
            </Button>
          </View>
        )),
      )}
    </>
  );
}
export function NativePhone({ link = false, onSuccess }) {
  useLanguage();
  const [phone, setPhone] = useState(link ? user?.phone || "" : ""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function send() {
    setBusy(true);
    try {
      const d = await api("/auth/otp/request", {
        phone,
        purpose: link ? "LINK" : "LOGIN",
      });
      setChallenge(d.challengeId);
      setMessage(d.message);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    try {
      const d = await api("/auth/otp/check", {
        challengeId: challenge,
        code,
        client: "MOBILE",
      });
      if (!link) await saveSession(d);
      setMessage(link ? "Phone verified." : "Signed in.");
      setError("");
      onSuccess?.(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.h2}>
        {link ? tr("Verify your phone") : tr("Phone OTP sign-in")}
      </Text>
      <Text style={s.muted}>
        {link
          ? tr("Link a phone to enable OTP sign-in.")
          : tr("Use a phone already verified in your account.")}
      </Text>
      <TextInput
        accessibilityLabel={tr("International phone number")}
        placeholder={tr("+919876543210")}
        placeholderTextColor="#777"
        style={[
          s.input,
          {
            marginTop: 20,
          },
        ]}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        editable={!challenge}
      />
      {challenge && (
        <TextInput
          accessibilityLabel={tr("Verification code")}
          style={s.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
        />
      )}
      <ErrorText message={error} />
      {message && <Text style={s.muted}>{tr(message)}</Text>}
      <Button disabled={busy} onPress={challenge ? verify : send}>
        {busy
          ? tr("Please wait…")
          : challenge
            ? tr("Verify code")
            : tr("Send verification code")}
      </Button>
    </View>
  );
}
export function NativeBilling() {
  useLanguage();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = () =>
    api("/billing")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  function cancel(sub) {
    Alert.alert(
      "Cancel renewal?",
      "Already-paid access remains until its expiry.",
      [
        {
          text: "Keep subscription",
          style: "cancel",
        },
        {
          text: "Cancel renewal",
          onPress: async () => {
            try {
              await api(`/billing/subscriptions/${sub.providerId}/cancel`, {});
              await load();
            } catch (e) {
              setError(e.message);
            }
          },
        },
      ],
    );
  }
  return (
    <View style={s.card}>
      <Text style={s.h2}>{tr("Study access")}</Text>
      <ErrorText message={error} />
      <Text style={s.text}>
        {data?.entitlement
          ? tr("Active until {0}", [
              new Date(data.entitlement.expiresAt).toLocaleDateString(),
            ])
          : tr("No active study pass")}
      </Text>
      {tr(
        data?.subscriptions?.map((sub) => (
          <View
            key={sub._id}
            style={{
              marginTop: 15,
            }}
          >
            <Text style={s.text}>
              {tr(sub.plan.name)}
              {tr(" \xB7 ")}
              {tr(sub.status)}
            </Text>
            {!["cancelled", "completed", "expired"].includes(sub.status) && (
              <Button secondary onPress={() => cancel(sub)}>
                {tr("Cancel renewal")}
              </Button>
            )}
          </View>
        )),
      )}
    </View>
  );
}
export function NativeAttachment({ id, index, remove }) {
  useLanguage();
  const [asset, setAsset] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api(`/attachments/${id}`)
      .then(setAsset)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <View style={s.card}>
      <Text style={s.small}>
        {tr("Answer page ")}
        {tr(index + 1)}
      </Text>
      {asset && (
        <Image
          source={{
            uri: asset.url,
          }}
          style={{
            height: 240,
            width: "100%",
            backgroundColor: "#fff",
          }}
          resizeMode="contain"
          accessibilityLabel={tr("Answer-sheet page {0}", [index + 1])}
        />
      )}
      <ErrorText message={error} />
      {asset?.text && <Text style={s.muted}>{tr(asset.text)}</Text>}
      {remove && (
        <Button secondary onPress={() => remove(id)}>
          {tr("Remove page")}
        </Button>
      )}
    </View>
  );
}
export function NativeAccountEditor({ onSaved }) {
  useLanguage();
  const [name, setName] = useState(user?.name || ""),
    [level, setLevel] = useState(user?.classLevel || "10"),
    [stream, setStream] = useState(user?.stream || "GENERAL"),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function save() {
    try {
      await updateProfile({
        name,
        classLevel: level,
        stream,
        language: getLanguage(),
      });
      setMessage("Profile saved.");
      setError("");
      onSaved?.();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.h2}>{tr("Your profile")}</Text>
      <TextInput
        accessibilityLabel={tr("Full name")}
        style={s.input}
        value={name}
        onChangeText={setName}
      />
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
      <View style={s.tabs}>
        {tr(
          (level === "10" ? ["GENERAL"] : ["SCIENCE", "ARTS", "COMMERCE"]).map(
            (v) => (
              <TouchableOpacity
                key={v}
                style={[s.tab, stream === v && s.tabActive]}
                onPress={() => setStream(v)}
              >
                <Text style={s.text}>{tr(v)}</Text>
              </TouchableOpacity>
            ),
          ),
        )}
      </View>
      <ErrorText message={error} />
      {message && <Text style={s.muted}>{tr(message)}</Text>}
      <Button onPress={save}>{tr("Save profile")}</Button>
    </View>
  );
}
