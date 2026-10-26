export class ApiError extends Error {
  status;
  details;
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export function createClient(base, token) {
  return async function request(
    path,
    body,
    method = body === undefined ? "GET" : "POST",
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new ApiError(
        res.status,
        data.message || "Request failed",
        data.details,
      );
    return data;
  };
}
