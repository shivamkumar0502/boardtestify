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
  } catch {
    access = null;
    user = null;
    await SecureStore.deleteItemAsync("bt-refresh");
    return false;
  }
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
    if (e.status === 401 && !path.startsWith("/auth")) {
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
