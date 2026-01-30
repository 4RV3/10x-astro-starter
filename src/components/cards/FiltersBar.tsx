import React from "react";
import type { ListCardsQuery } from "../../types";

interface Props {
  value: Pick<ListCardsQuery, "origin" | "sort">;
  onChange: (q: Pick<ListCardsQuery, "origin" | "sort">) => void;
}

export default function FiltersBar({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 items-center">
      <label className="text-sm">Pochodzenie:</label>
      <select
        value={value.origin ?? ""}
        onChange={(e) => onChange({ ...value, origin: (e.target.value || undefined) as any })}
        className="border rounded px-2 py-1"
        aria-label="Filtruj pochodzenie"
      >
        <option value="">Wszystkie</option>
        <option value="manual">Ręczne</option>
        <option value="ai">AI</option>
      </select>
      <label className="text-sm ml-4">Sortuj:</label>
      <select
        value={value.sort ?? "created_at_desc"}
        onChange={(e) => onChange({ ...value, sort: e.target.value as any })}
        className="border rounded px-2 py-1"
        aria-label="Sortowanie"
      >
        <option value="created_at_desc">Najnowsze</option>
        <option value="created_at_asc">Najstarsze</option>
        <option value="due_at_asc">Najbliższe powtórki</option>
      </select>
    </div>
  );
}
