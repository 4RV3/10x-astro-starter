export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const res = await fetch(input, { ...init, headers, credentials: "include" });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login?reason=session_expired";
    }
    throw new Error("Unauthorized");
  }

  return res;
}
