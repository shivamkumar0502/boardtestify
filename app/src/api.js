import * as SecureStore from "expo-secure-store";
import { createClient } from "@boardtestify/api-client";
let access = null;
export let user = null;
const raw = createClient(
  process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:4000/api",
  () => access,
);
export async function saveSession(d) {
  access = d.token;
  user = d.user;
  await SecureStore.setItemAsync("bt-refresh", d.refreshToken);
}
let refreshing = null;
export async function restore() {
  const token = await SecureStore.getItemAsync("bt-refresh");
  if (!token) return false;
  try {
    await saveSession(
      await raw("/auth/mobile-refresh", { refreshToken: token }),
    );
    return true;
  } catch (e) {
    if (e.status === 401 || e.status === 400) {
      access = null;
      user = null;
      await SecureStore.deleteItemAsync("bt-refresh");
    }
    return false;
  }
}
export async function uploadFile(path, file, fields) {
  try {
    return await raw.upload(path, file, fields);
  } catch (e) {
    if (e.status === 401 && (await restore()))
      return raw.upload(path, file, fields);
    throw e;
  }
}
export async function updateProfile(data) {
  user = await api("/auth/me", data, "PATCH");
  return user;
}
export async function login(email, password) {
  await saveSession(await raw("/auth/mobile-login", { email, password }));
}
export async function register(d) {
  await raw("/auth/register", d);
  await login(d.email, d.password);
}
export async function logout() {
  const token = await SecureStore.getItemAsync("bt-refresh");
  if (token)
    await raw("/auth/mobile-logout", { refreshToken: token }).catch(() => {});
  access = null;
  user = null;
  await SecureStore.deleteItemAsync("bt-refresh");
}
export async function api(path, body, method) {
  try {
    return await raw(path, body, method);
  } catch (e) {
    if (
      e.status === 401 &&
      ![
        "/auth/login",
        "/auth/register",
        "/auth/refresh",
        "/auth/mobile-login",
        "/auth/mobile-refresh",
        "/auth/mobile-logout",
      ].includes(path)
    ) {
      refreshing ??= restore()
        .then((ok) => {
          if (!ok) throw Error("Session expired. Please sign in again.");
        })
        .finally(() => {
          refreshing = null;
        });
      await refreshing;
      return raw(path, body, method);
    }
    throw e;
  }
}
