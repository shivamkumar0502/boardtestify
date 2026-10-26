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
    if (e.status === 401 && !path.startsWith("/auth")) {
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
