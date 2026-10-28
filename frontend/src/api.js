import { createClient } from "@boardtestify/api-client";
let token = null;
export const setToken = (v) => {
  token = v;
};
export const api = createClient(
  import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? "/api" : "http://localhost:4000/api"),
  () => token,
);
let pending = null;
export async function request(path, body, method) {
  try {
    return await api(path, body, method);
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
      pending ??= api("/auth/refresh", {})
        .then((d) => {
          setToken(d.token);
          return d;
        })
        .finally(() => {
          pending = null;
        });
      await pending;
      return api(path, body, method);
    }
    throw e;
  }
}
export async function uploadFile(path, file, fields) {
  try {
    return await api.upload(path, file, fields);
  } catch (e) {
    if (e.status === 401) {
      const d = await api("/auth/refresh", {});
      setToken(d.token);
      return api.upload(path, file, fields);
    }
    throw e;
  }
}
