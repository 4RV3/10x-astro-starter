import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/http";

interface Proposal {
  front: string;
  back: string;
  source_snippet?: string;
}

interface Notice {
  variant: "success" | "error";
  message: string;
}

export default function Generator() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const generate = async () => {
    if (!text.trim()) return;
    setNotice(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ input_text: text }),
      });
      if (res.status === 503) {
        setNotice({
          variant: "error",
          message: "Usługa AI chwilowo niedostępna (503). Spróbuj ponownie później.",
        });
        return;
      }
      const data = await res.json();
      setProposals(data.cards ?? data ?? []);
    } catch (e) {
      console.error(e);
      setNotice({ variant: "error", message: "Wystąpił błąd podczas generowania." });
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    if (!proposals.length) return;
    setNotice(null);

    try {
      const res = await apiFetch("/api/ai/cards/batch", {
        method: "POST",
        body: JSON.stringify({ cards: proposals }),
      });

      if (res.ok) {
        setProposals([]);
        setNotice({ variant: "success", message: "Zapisano fiszki." });
        return;
      }

      const errText = await res.text().catch(() => "");
      setNotice({
        variant: "error",
        message: errText ? `Błąd zapisu: ${errText}` : "Nie udało się zapisać fiszek.",
      });
    } catch (e) {
      console.error(e);
      setNotice({ variant: "error", message: "Nie udało się zapisać fiszek." });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-3">
        {notice && (
          <div
            className={`text-sm rounded border p-3 ${
              notice.variant === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role="status"
            aria-live="polite"
          >
            {notice.message}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wklej tekst..."
          className="w-full min-h-[200px] md:min-h-[300px] p-3 border rounded"
        />
        <button disabled={loading} onClick={generate} className="mt-2 px-3 py-2 bg-black text-white rounded">
          {loading ? "Generowanie..." : "Generuj"}
        </button>
      </div>
      <div>
        {!proposals.length ? (
          <div className="text-sm text-gray-600">Brak wyników. Wklej tekst i kliknij Generuj.</div>
        ) : (
          <div className="grid gap-3">
            <div className="flex gap-2">
              <button onClick={saveAll} className="px-3 py-2 bg-black text-white rounded">
                Zapisz wszystkie
              </button>
              <button onClick={() => setProposals([])} className="px-3 py-2 border rounded">
                Odrzuć wyniki
              </button>
            </div>
            {proposals.map((p, i) => (
              <div key={i} className="p-3 border rounded bg-white">
                <div className="font-medium">{p.front}</div>
                <div className="mt-2 text-gray-700 whitespace-pre-wrap">{p.back}</div>
                {p.source_snippet && <div className="mt-2 text-xs text-gray-500">{p.source_snippet}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
