import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/http";

interface Card {
  id: string;
  front: string;
  back: string;
  source_snippet?: string;
}

export default function ReviewSession() {
  const [cards, setCards] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const current = useMemo(() => cards[idx], [cards, idx]);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/study/due-cards");
      if (!res.ok) return;
      const data = await res.json();
      setCards(data.cards ?? data ?? []);
    })();
  }, []);

  const rate = async (score: number) => {
    if (!current) return;
    await apiFetch("/api/study/review", {
      method: "POST",
      body: JSON.stringify({ card_id: current.id, grade: score }),
    });
    setShowBack(false);
    setIdx((i) => i + 1);
  };

  if (!current) {
    return (
      <div className="grid gap-4">
        <div className="text-center text-sm text-gray-600">Brak fiszek do powtórki.</div>
        <div className="flex flex-wrap gap-2 justify-center">
          <a href="/ai/generate" className="px-3 py-2 bg-black text-white rounded">
            Wygeneruj fiszki z tekstu
          </a>
          <a href="/cards/new" className="px-3 py-2 border rounded">
            Dodaj fiszkę ręcznie
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto grid gap-4">
      <div className="p-4 border rounded bg-white">
        <div className="font-medium">{current.front}</div>
        {showBack ? (
          <div className="mt-3 text-gray-700 whitespace-pre-wrap">{current.back}</div>
        ) : (
          <button className="mt-3 px-3 py-2 bg-black text-white rounded" onClick={() => setShowBack(true)}>
            Pokaż odpowiedź
          </button>
        )}
      </div>
      {showBack && (
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => rate(s)} className="px-3 py-2 border rounded hover:bg-gray-50">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
