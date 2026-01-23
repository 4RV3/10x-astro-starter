# Plan schematu bazy danych (PostgreSQL / Supabase) — FlashAI (MVP)

## 1) Lista tabel (kolumny, typy, ograniczenia)

> Konwencje:
> - Wszystkie tabele domenowe w schemacie `public`.
> - Użytkownicy i hasła: `auth.users` (Supabase Auth) jest źródłem prawdy.
> - Identyfikator użytkownika: `uuid` zgodny z `auth.users.id` / `auth.uid()`.
> - Timestamps w UTC (`timestamptz`).

### 1.0 `users`

This table is managed by Supabase Auth

- id uuid PRIMARY KEY
- email: VARCHAR(255) NOT NULL UNIQUE
- encrypted_password: VARCHAR NOT NULL
- created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- confirmed_at: TIMESTAMPTZ

---

### 1.1 `public.profiles`
Dane profilowe użytkownika (1:1 z Supabase Auth), w tym `username`.

- `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `username text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Ograniczenia:
- `CHECK (length(btrim(username)) > 0)` — brak pustych/whitespace
- (opcjonalnie, rekomendowane) `CHECK (char_length(username) BETWEEN 3 AND 32)`
- (opcjonalnie, rekomendowane) `CHECK (username ~ '^[A-Za-z0-9_\.]+$')` — jeśli chcemy ograniczyć znaki (do potwierdzenia produktowo)

Unikalność (normalizacja):
- Unikalny indeks na znormalizowanej wartości (bez `citext` dla prostoty wdrożenia):
  - `UNIQUE (lower(username))`

Uwagi:
- `updated_at` aktualizowane triggerem (patrz sekcja “Uwagi”).

---

### 1.2 `public.cards`
Główna tabela domenowa: fiszki Basic (front/back tekst) + stan SM‑2 w rekordzie.

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `origin text NOT NULL DEFAULT 'manual'`  
  Ograniczenie: `CHECK (origin IN ('manual','ai'))` (metryki + rozróżnienie pochodzenia)
- `front text NOT NULL`
- `back text NOT NULL`
- `source_snippet text NOT NULL`

SM‑2 (minimalny stan per karta):
- `ease_factor numeric(4,2) NOT NULL DEFAULT 2.50`
  - `CHECK (ease_factor >= 1.30 AND ease_factor <= 3.00)`
- `interval_days integer NOT NULL DEFAULT 0`
  - `CHECK (interval_days >= 0)`
- `repetitions integer NOT NULL DEFAULT 0`
  - `CHECK (repetitions >= 0)`
- `due_at timestamptz NOT NULL DEFAULT now()`
- `last_reviewed_at timestamptz NULL`

Metadane:
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Ograniczenia treści:
- `CHECK (length(btrim(front)) > 0)`
- `CHECK (length(btrim(back)) > 0)`
- `CHECK (length(btrim(source_snippet)) > 0)` — krytyczne wg PRD (odrzuca pusty string/whitespace)
- (opcjonalnie, techniczne limity DB — do decyzji):
  - np. `CHECK (char_length(front) <= 10000)` itd. (PRD: brak limitów produktowych, ale można dać bezpieczne techniczne)

Uwagi:
- `due_at` domyślnie `now()` pozwala traktować nowe karty jako “due” od razu.
- `updated_at` aktualizowane triggerem.

---

### 1.3 (Opcjonalnie, NIE wymagane w MVP) `public.card_reviews`
Tabela historii ocen do audytu/metryk (odłożone, jeśli nie ma potrzeby na start).

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE`
- `owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `grade smallint NOT NULL CHECK (grade BETWEEN 0 AND 5)`
- `reviewed_at timestamptz NOT NULL DEFAULT now()`

Uwagi:
- Jeśli wdrażana, RLS analogicznie do `cards`.
- W MVP można pominąć całkowicie.

---

## 2) Relacje między tabelami

- `auth.users (1) — (1) public.profiles`  
  - `profiles.id` jest jednocześnie PK i FK do `auth.users.id`.
- `auth.users (1) — (N) public.cards`  
  - `cards.owner_id` wskazuje właściciela fiszki.
- (opcjonalnie) `public.cards (1) — (N) public.card_reviews`  
  - `card_reviews.card_id` wskazuje fiszkę; dodatkowo `owner_id` ułatwia RLS i indeksy.

Kardynalności:
- 1:1 — users:profiles
- 1:N — users:cards
- (opcjonalnie) 1:N — cards:card_reviews

Brak relacji wiele‑do‑wielu w MVP (brak talii/tagów).

---

## 3) Indeksy

### 3.1 `public.profiles`
- Unikalność username po normalizacji:
  - `CREATE UNIQUE INDEX profiles_username_lower_ux ON public.profiles (lower(username));`

### 3.2 `public.cards`
Krytyczne ścieżki: lista fiszek użytkownika i selekcja “due”.

- Do powtórek (due), stabilne sortowanie:
  - `CREATE INDEX cards_owner_due_id_ix ON public.cards (owner_id, due_at, id);`
  - Wspiera:  
    `WHERE owner_id = auth.uid() AND due_at <= now()`  
    `ORDER BY due_at, id`

- Do listy fiszek (np. sort po dacie tworzenia):
  - `CREATE INDEX cards_owner_created_id_ix ON public.cards (owner_id, created_at DESC, id);`

- (opcjonalnie) jeśli często pobieramy pojedynczą kartę po `id` i sprawdzamy owner:
  - PK na `id` wystarcza; RLS i tak ograniczy widoczność.

### 3.3 (Opcjonalnie) `public.card_reviews`
- `CREATE INDEX card_reviews_owner_reviewed_ix ON public.card_reviews (owner_id, reviewed_at DESC);`
- `CREATE INDEX card_reviews_card_reviewed_ix ON public.card_reviews (card_id, reviewed_at DESC);`

---

## 4) Zasady PostgreSQL / RLS (Supabase)

> Założenie: “private-by-default” — anon nie ma dostępu do tabel domenowych.

### 4.1 `public.profiles` — RLS
Włącz RLS:
- `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`

Polityki:
- SELECT: użytkownik widzi tylko swój profil  
  - `USING (id = auth.uid())`
- INSERT: użytkownik może utworzyć swój profil (id musi równać się `auth.uid()`)  
  - `WITH CHECK (id = auth.uid())`
- UPDATE: użytkownik może aktualizować tylko swój profil  
  - `USING (id = auth.uid()) WITH CHECK (id = auth.uid())`
- DELETE: opcjonalnie zablokować (profil zwykle usuwa się przez usunięcie konta w Auth)  
  - rekomendacja: brak polityki DELETE (czyli brak uprawnień)

Uwagi:
- Jeśli aplikacja ma publicznie pokazywać username innych użytkowników: w MVP nie ma takiej potrzeby; pozostaje prywatne.

### 4.2 `public.cards` — RLS
Włącz RLS:
- `ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;`

Polityki:
- SELECT: użytkownik widzi tylko swoje fiszki  
  - `USING (owner_id = auth.uid())`
- INSERT: użytkownik może tworzyć tylko swoje fiszki  
  - `WITH CHECK (owner_id = auth.uid())`
- UPDATE: użytkownik może edytować tylko swoje fiszki  
  - `USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())`
- DELETE: użytkownik może usuwać tylko swoje fiszki (hard delete)  
  - `USING (owner_id = auth.uid())`

### 4.3 (Opcjonalnie) `public.card_reviews` — RLS
Analogicznie:
- SELECT/INSERT/UPDATE/DELETE ograniczone do `owner_id = auth.uid()`.

### 4.4 Atomowy zapis “Zapisz wszystkie” (AI batch)
Rekomendacja implementacyjna (dla atomowości i kontroli inputu):
- RPC/SQL function `public.insert_cards_batch(cards jsonb)` wykonywana w jednej transakcji.
- Funkcja:
  - wymusza `owner_id = auth.uid()` (ignoruje/nie przyjmuje owner_id z payloadu),
  - waliduje wymagane pola (front/back/source_snippet niepuste),
  - ustawia `origin = 'ai'` dla batcha z AI,
  - wykonuje `INSERT ... SELECT ...` z `jsonb_to_recordset`.

Uwaga: nawet bez funkcji, pojedynczy `INSERT INTO cards (...) VALUES (...), (...), ...` jest atomowy w Postgres, ale RPC ułatwia walidację i spójne zachowanie.

---

## 5) Dodatkowe uwagi / decyzje projektowe

1. **Normalizacja do 3NF**: domena jest prosta; przechowujemy SM‑2 bez normalizacji do osobnej tabeli (uzasadniona denormalizacja pod wydajność i prostotę MVP).
2. **Walidacja `source_snippet` w DB**: kluczowa (NOT NULL + CHECK na `btrim`), zgodnie z PRD.
3. **`updated_at`**: zastosować standardowy trigger:
   - funkcja `set_updated_at()` ustawiająca `NEW.updated_at = now()`.
   - trigger `BEFORE UPDATE` na `profiles` i `cards`.
4. **Rozszerzenia**:
   - `pgcrypto` dla `gen_random_uuid()` (w Supabase zwykle dostępne).
   - `citext` opcjonalnie, jeśli zdecydujecie się na `username citext`; w tym planie użyto `text + unique(lower())`.
5. **Hard delete**: realizowane przez `DELETE` na `cards`; brak soft delete w MVP.
6. **Przyszła rozbudowa**:
   - talie/tagi/wyszukiwarka: osobne tabele + indeksy full‑text (poza MVP),
   - metryki/audyt: dołożyć `card_reviews` i ewentualne zdarzenia, jeśli potrzebne.