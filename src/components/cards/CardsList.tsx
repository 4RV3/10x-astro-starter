import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/http";
import FiltersBar from "./FiltersBar";

interface Card {
  id: string;
  front: string;
  back: string;
  origin?: "manual" | "ai";
  created_at?: string;
}

type ListResponse = { data: Card[]; pagination: { page: number; page_size: number; total_pages: number } } | Card[];

export default function CardsList() {
  const [items, setItems] = useState<Card[]>([]);
  const [page, setPage] = useState(1);
  const [origin, setOrigin] = useState<string>("");
  const [sort, setSort] = useState<string>("created_at_desc");
  const [hasMore, setHasMore] = useState(true);

  const load = async (reset = false) => {
    const params = new URLSearchParams({ page: String(reset ? 1 : page), page_size: "20", sort });
    if (origin) params.set("origin", origin);
    const res = await apiFetch(`/api/cards?${params.toString()}`);
    const data: ListResponse = await res.json();
    const list = Array.isArray(data) ? data : data.data;
    setItems(reset ? list : [...items, ...list]);
    if (!Array.isArray(data)) {
      const nextPage = (reset ? 1 : page) + 1;
      setHasMore(nextPage <= data.pagination.total_pages);
      setPage(reset ? 2 : page + 1);
    } else {
      setHasMore(list.length > 0);
      setPage(reset ? 2 : page + 1);
    }
  };

  useEffect(() => {
    load(true); /* initial */
  }, []);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <FiltersBar
          value={{ origin: (origin || undefined) as any, sort: sort as any }}
          onChange={(v) => {
            setOrigin(v.origin || "");
            setSort(v.sort || "created_at_desc");
            load(true);
          }}
        />
        <a href="/cards/new" className="ml-auto px-3 py-2 bg-black text-white rounded text-sm">
          Dodaj fiszkę
        </a>
      </div>
      {items.map((c) => (
        <div key={c.id} className="p-3 border rounded bg-white">
          <div className="font-medium">{c.front}</div>
          <div className="mt-1 text-sm text-gray-700 line-clamp-2">{c.back}</div>
          <div className="mt-2 text-xs text-gray-500">{c.created_at}</div>
          <div className="mt-2 flex gap-2">
            <a href={`/cards/${c.id}`} className="px-2 py-1 border rounded text-xs">
              Podgląd/Edycja
            </a>
            <button
              onClick={async () => {
                if (!confirm("Usunąć tę fiszkę?")) return;
                const res = await apiFetch(`/api/cards/${c.id}`, { method: "DELETE" });
                if (res.ok) setItems((prev) => prev.filter((x) => x.id !== c.id));
              }}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs"
            >
              Usuń
            </button>
          </div>
        </div>
      ))}
      {hasMore && (
        <button onClick={() => load(false)} className="px-3 py-2 border rounded w-full md:w-auto">
          Załaduj więcej
        </button>
      )}
    </div>
  );
}
