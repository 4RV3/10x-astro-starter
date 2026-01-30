import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";

export default function RequestPasswordResetForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Podaj adres e‑mail");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Niezależnie od wyniku nie ujawniamy istnienia konta
      if (!res.ok) {
        // nadal pokaż komunikat ogólny
      }
      setMessage("Jeżeli konto istnieje, wysłaliśmy instrukcje zmiany hasła na podany adres e‑mail.");
    } catch (err) {
      setMessage("Jeżeli konto istnieje, wysłaliśmy instrukcje zmiany hasła na podany adres e‑mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" aria-describedby={error ? "reset-error" : undefined}>
      {error && (
        <div id="reset-error" role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
          {message}
        </div>
      )}
      <div className="grid gap-1.5">
        <label htmlFor={emailId} className="text-sm font-medium">
          E‑mail
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          className="border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button disabled={loading} aria-busy={loading} className="w-full">
        {loading ? "Wysyłanie…" : "Wyślij instrukcje"}
      </Button>
    </form>
  );
}
