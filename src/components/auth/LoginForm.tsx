import React, { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const userId = useId();
  const passId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const registered = p.get("registered");
    const reason = p.get("reason");
    if (registered === "1") setInfo("Konto utworzone. Możesz się zalogować.");
    else if (reason === "session_expired") setInfo("Twoja sesja wygasła. Zaloguj się ponownie.");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Wypełnij wymagane pola");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        // Don't leak whether account exists; but do show configuration/server issues.
        let serverError: any = null;
        try { serverError = await res.json(); } catch {}

        if (res.status >= 500 && serverError?.message) {
          setError(serverError.message);
        } else {
          setError("Nieprawidłowa nazwa użytkownika lub hasło.");
        }
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirectTo") || "/study";
      window.location.href = redirectTo;
    } catch (err) {
      setError("Wystąpił problem, spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" aria-describedby={error ? "login-error" : undefined}>
      {info && (
        <div role="status" className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
          {info}
        </div>
      )}
      {error && (
        <div id="login-error" role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={userId} className="text-sm font-medium">Nazwa użytkownika</label>
        <input
          id={userId}
          name="username"
          autoComplete="username"
          className="border rounded px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={passId} className="text-sm font-medium">Hasło</label>
        <input
          id={passId}
          name="password"
          type="password"
          autoComplete="current-password"
          className="border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button disabled={loading} aria-busy={loading} className="w-full">{loading ? "Logowanie…" : "Zaloguj się"}</Button>
    </form>
  );
}
