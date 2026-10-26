import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 20, paddingBottom: 55 },
  brand: {
    color: "#f5f5f5",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 30,
  },
  accent: { color: "#ff7a35" },
  eyebrow: {
    color: "#a1a1aa",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 10,
  },
  h1: {
    color: "#f4f4f5",
    fontSize: 31,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: -1,
  },
  h2: { color: "#f4f4f5", fontSize: 21, fontWeight: "600", marginBottom: 12 },
  text: { color: "#c7c7cf", fontSize: 15, lineHeight: 25 },
  muted: { color: "#94949f", fontSize: 13, lineHeight: 22 },
  card: {
    backgroundColor: "#131315",
    padding: 20,
    borderWidth: 1,
    borderColor: "#2d2d32",
    borderRadius: 10,
    marginBottom: 15,
  },
  input: {
    backgroundColor: "#151518",
    borderColor: "#3a3a42",
    borderWidth: 1,
    borderRadius: 7,
    color: "#f5f5f5",
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#ff7a35",
    padding: 15,
    borderRadius: 7,
    alignItems: "center",
    marginTop: 12,
    minHeight: 49,
  },
  buttonText: { color: "#160e08", fontSize: 14, fontWeight: "700" },
  ghost: { backgroundColor: "#222227", borderWidth: 1, borderColor: "#3e3e47" },
  ghostText: { color: "#e4e4ec" },
  error: {
    color: "#ffc4b0",
    backgroundColor: "#38201a",
    padding: 13,
    borderRadius: 6,
    marginBottom: 16,
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  tabs: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginVertical: 20 },
  tab: {
    backgroundColor: "#202024",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#4a2a19",
    borderColor: "#ff7a35",
    borderWidth: 1,
  },
  small: { color: "#8e8e9b", fontSize: 11, marginBottom: 8 },
  option: {
    padding: 17,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#35353f",
    backgroundColor: "#131317",
    marginBottom: 12,
  },
  selected: { borderColor: "#ff7a35", backgroundColor: "#2d1f17" },
  palette: {
    width: 43,
    height: 43,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#45454f",
  },
  timer: {
    fontSize: 24,
    fontWeight: "600",
    color: "#ffb17e",
    fontVariant: ["tabular-nums"],
  },
  answer: { minHeight: 180, textAlignVertical: "top", lineHeight: 25 },
  label: { color: "#c7c7cf", fontSize: 12, marginBottom: 8 },
});
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.ghost, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, secondary && s.ghostText]}>{children}</Text>
    </TouchableOpacity>
  );
}
export function ErrorText({ message }) {
  return message ? (
    <Text accessibilityRole="alert" style={s.error}>
      {message}
    </Text>
  ) : null;
}
