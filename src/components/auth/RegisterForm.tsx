import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";

export default function RegisterForm() {
  const uId = useId();
  const eId = useId();
  const p1Id = useId();
  const p2Id = useId();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username || !email || !password || !passwordConfirm) {
      setError("Wypełnij wszystkie pola");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Hasła muszą być zgodne");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          // Show server-provided message when available
          setError(
            data?.error === "USERNAME_CONFLICT"
              ? "Ta nazwa użytkownika jest już zajęta."
              : data?.message || "Nie udało się utworzyć konta. Spróbuj ponownie."
          );
        } catch {
          setError("Nie udało się utworzyć konta. Spróbuj ponownie.");
        }
        return;
      }
      window.location.href = "/auth/login?registered=1";
    } catch (err: any) {
      setError("Nie udało się utworzyć konta. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" aria-describedby={error ? "register-error" : undefined}>
      {error && (
        <div
          id="register-error"
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2"
        >
          {error}
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={uId} className="text-sm font-medium">
          Nazwa użytkownika
        </label>
        <input
          id={uId}
          className="border rounded px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={eId} className="text-sm font-medium">
          E‑mail
        </label>
        <input
          id={eId}
          type="email"
          autoComplete="email"
          className="border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={p1Id} className="text-sm font-medium">
          Hasło
        </label>
        <input
          id={p1Id}
          type="password"
          autoComplete="new-password"
          className="border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={p2Id} className="text-sm font-medium">
          Powtórz hasło
        </label>
        <input
          id={p2Id}
          type="password"
          autoComplete="new-password"
          className="border rounded px-3 py-2"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
        />
      </div>
      <Button disabled={loading} aria-busy={loading} className="w-full">
        {loading ? "Rejestrowanie…" : "Załóż konto"}
      </Button>
    </form>
  );
}
