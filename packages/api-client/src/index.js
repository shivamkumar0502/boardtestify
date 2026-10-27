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
  async function request(
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
  }
  request.upload = async (path, file, fields = {}) => {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields))
      form.append(key, String(value));
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new ApiError(
        res.status,
        data.message || "Upload failed",
        data.details,
      );
    return data;
  };
  return request;
}
