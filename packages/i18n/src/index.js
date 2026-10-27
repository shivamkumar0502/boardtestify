import { useSyncExternalStore } from "react";
import hindi from "./hi.js";
let current = "en";
try {
  current = globalThis.localStorage?.getItem("bt-lang") === "hi" ? "hi" : "en";
} catch {}
globalThis.document?.documentElement?.setAttribute("lang", current);
const listeners = new Set();
export function setLanguage(lang) {
  current = lang === "hi" ? "hi" : "en";
  globalThis.document?.documentElement?.setAttribute("lang", current);
  try {
    globalThis.localStorage?.setItem("bt-lang", current);
  } catch {}
  for (const cb of listeners) cb();
}
export const getLanguage = () => current;
export function useLanguage() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLanguage,
    () => "en",
  );
}
export function tr(value, values = []) {
  if (typeof value !== "string") return value;
  const translated = current === "hi" ? hindi[value.trim()] : undefined;
  let output = translated
    ? `${value.match(/^\s*/)[0]}${translated}${value.match(/\s*$/)[0]}`
    : value;
  if (values.length)
    output = output.replace(/\{(\d+)\}/g, (_, n) => {
      const v = values[Number(n)] ?? "";
      return current === "hi" && typeof v === "string" && hindi[v]
        ? hindi[v]
        : String(v);
    });
  return output;
}
export const locale = () => (current === "hi" ? "hi-IN" : "en-IN");
