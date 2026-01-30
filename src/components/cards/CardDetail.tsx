import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/http";
import type { CardDTO } from "../../types";

interface Props {
  id: string;
}

export default function CardDetail({ id }: Props) {
  const [card, setCard] = useState<CardDTO | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/api/cards/${id}`);
      if (!res.ok) {
        setError("Nie znaleziono fiszki.");
        return;
      }
      const data = await res.json();
      setCard(data);
    })();
  }, [id]);

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!card) return;
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/cards/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) {
        setError("Błąd zapisu.");
        return;
      }
      const updated = await res.json();
      setCard(updated);
      setEditing(false);
      alert("Zapisano zmiany.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!card) return;
    if (!confirm("Czy na pewno chcesz usunąć tę fiszkę?")) return;
    const res = await apiFetch(`/api/cards/${id}`, { method: "DELETE" });
    if (res.ok) {
      alert("Usunięto fiszkę.");
      window.location.href = "/cards";
    } else {
      alert("Nie udało się usunąć.");
    }
  };

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!card) return <div className="text-sm text-gray-600">Ładowanie...</div>;

  return (
    <div className="grid gap-4">
      {!editing ? (
        <div className="p-4 border rounded bg-white">
          <div className="font-medium">{card.front}</div>
          <div className="mt-2 text-gray-700 whitespace-pre-wrap">{card.back}</div>
          {card.source_snippet && <div className="mt-2 text-xs text-gray-500">{card.source_snippet}</div>}
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-2 border rounded" onClick={() => setEditing(true)}>
              Edytuj
            </button>
            <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={onDelete}>
              Usuń
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSave} className="max-w-xl grid gap-3">
          <input
            name="front"
            defaultValue={card.front}
            className="border rounded px-3 py-2"
            required
            aria-label="Front"
          />
          <textarea
            name="back"
            defaultValue={card.back}
            className="border rounded px-3 py-2 min-h-[120px]"
            required
            aria-label="Back"
          />
          <textarea
            name="source_snippet"
            defaultValue={card.source_snippet ?? ""}
            className="border rounded px-3 py-2 min-h-[80px]"
            aria-label="Źródło"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-3 py-2 bg-black text-white rounded">
              {saving ? "Zapisywanie..." : "Zapisz"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 border rounded">
              Anuluj
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
