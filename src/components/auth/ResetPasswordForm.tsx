import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ResetPasswordForm() {
  const p1Id = useId();
  const p2Id = useId();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!p1 || !p2) {
      setError("Wypełnij oba pola");
      return;
    }
    if (p1 !== p2) {
      setError("Hasła muszą być zgodne");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: p1 }),
      });
      if (!res.ok) throw new Error("failed");
      setOk("Hasło zostało zmienione. Możesz się zalogować.");
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 800);
    } catch (err) {
      setError("Nie udało się zmienić hasła. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" aria-describedby={error ? "pw-error" : undefined}>
      {error && (
        <div id="pw-error" role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      {ok && (
        <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
          {ok}
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={p1Id} className="text-sm font-medium">
          Nowe hasło
        </label>
        <input
          id={p1Id}
          type="password"
          autoComplete="new-password"
          className="border rounded px-3 py-2"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
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
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          required
        />
      </div>
      <Button disabled={loading} aria-busy={loading} className="w-full">
        {loading ? "Zapisywanie…" : "Ustaw nowe hasło"}
      </Button>
    </form>
  );
}
