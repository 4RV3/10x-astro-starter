# API Endpoint Implementation Plan List


# API Endpoint Implementation Plan: /auth/register

## 1. Przegląd punktu końcowego
Rejestracja użytkownika przez Supabase Auth z jednoczesnym utworzeniem rekordu `public.profiles` i zwróceniem sesji.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /auth/register
- Parametry:
  - Wymagane: email, password, username
  - Opcjonalne: brak
- Request Body: { email: string, password: string, username: string }

## 3. Wykorzystywane typy
- DTO: RegisterCommand, RegisterResponseDTO, AuthUserDTO, ProfileDTO, SessionDTO
- Command: RegisterCommand

## 3. Szczegóły odpowiedzi
- 201: RegisterResponseDTO z polami user, profile, session
- 400: błędny email/hasło/username (format, brak, długość)
- 409: konflikt unikalności email/username
- 500: błąd serwera (np. nieudane utworzenie profilu)

## 4. Przepływ danych
1) Zod: walidacja treści żądania.
2) Supabase Auth: signUp(email, password).
3) Po sukcesie: insert do `public.profiles` (id = auth.users.id, username).
4) Pobierz sesję (token JWT) i zwróć user + profile + session.

## 5. Względy bezpieczeństwa
- Uwierzytelnienie Supabase Auth; hasła nigdy nie w bazie domenowej.
- Ochrona przed brute-force: rate limiting na endpoint.
- Nie logować pełnych haseł; sanityzacja wejścia.

## 6. Obsługa błędów
- Mapuj unikalność username/email → 409.
- Walidacja wejścia → 400.
- Niepowodzenie po stronie Auth/DB → 500.

## 7. Rozważania dotyczące wydajności
- Brak ciężkich operacji; dodać limitowanie i backoff.

## 8. Etapy wdrożenia
1) Zdefiniować Zod schema dla RegisterCommand.
2) Implementować handler korzystający z `context.locals.supabase`.
3) Wywołać signUp, dodać rekord w `public.profiles` z RLS.
4) Zwrócić RegisterResponseDTO (201).


# API Endpoint Implementation Plan: /auth/login

## 1. Przegląd punktu końcowego
Logowanie przez username: mapowanie username→email, następnie Supabase Auth signIn.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /auth/login
- Parametry:
  - Wymagane: username, password
  - Opcjonalne: brak
- Request Body: { username: string, password: string }

## 3. Wykorzystywane typy
- DTO: LoginCommand, LoginResponseDTO, AuthUserDTO, SessionDTO
- Command: LoginCommand

## 3. Szczegóły odpowiedzi
- 200: LoginResponseDTO (user, profile subset, session)
- 400: brak username/password
- 401: nieprawidłowe poświadczenia
- 500: błąd dostawcy Auth

## 4. Przepływ danych
1) Zod: walidacja.
2) SELECT `profiles` gdzie lower(username)=lower(:username) → email.
3) Supabase Auth: signIn(email, password).
4) Pobierz profil i zwróć (user + profile + session).

## 5. Względy bezpieczeństwa
- Rate limiting / backoff na nieudane logowania.
- Unikać rozróżnienia „nie istnieje” vs. „złe hasło” (zwracaj 401).

## 6. Obsługa błędów
- 400: brak wymaganych pól.
- 401: błędne poświadczenia.
- 500: błąd po stronie Auth.

## 7. Rozważania dotyczące wydajności
- Prosty lookup + Auth; rozważyć indeks na lower(username) (jest w DB plan).

## 8. Etapy wdrożenia
1) Zod schema dla LoginCommand.
2) Pobierz email przez `profiles`.
3) signIn, zwróć DTO (200).


# API Endpoint Implementation Plan: /auth/logout

## 1. Przegląd punktu końcowego
Wylogowanie z unieważnieniem bieżącej sesji.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /auth/logout
- Parametry: brak
- Nagłówek: Authorization: Bearer <token>

## 3. Wykorzystywane typy
- Brak body; odpowiedź pusta

## 3. Szczegóły odpowiedzi
- 204: No Content
- 401: brak/niepoprawny token

## 4. Przepływ danych
1) Supabase Auth: signOut dla bieżącego tokena.

## 5. Względy bezpieczeństwa
- Wymagany ważny JWT.

## 6. Obsługa błędów
- 401 przy niepoprawnym tokenie.

## 7. Rozważania dotyczące wydajności
- Operacja lekka.

## 8. Etapy wdrożenia
1) Handler odczytujący token.
2) Wywołanie signOut.


# API Endpoint Implementation Plan: /auth/me

## 1. Przegląd punktu końcowego
Zwraca bieżącego użytkownika i jego profil.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: /auth/me
- Parametry: brak
- Nagłówek: Authorization: Bearer <token>

## 3. Wykorzystywane typy
- DTO: MeResponseDTO, AuthUserDTO, ProfileDTO

## 3. Szczegóły odpowiedzi
- 200: MeResponseDTO
- 401: nieautoryzowany
- 404: profil nie istnieje (edge case)

## 4. Przepływ danych
1) Walidacja tokena.
2) SELECT z `profiles` przez id=auth.uid().
3) Zwróć user (z Auth) + profile.

## 5. Względy bezpieczeństwa
- RLS ogranicza widoczność profilu do właściciela.

## 6. Obsługa błędów
- 401: wygasła/niepoprawna sesja.
- 404: brak profilu.

## 7. Rozważania dotyczące wydajności
- Pojedyncze SELECTy.

## 8. Etapy wdrożenia
1) Handler GET.
2) Pobierz profil przez Supabase klient z `context.locals`.


# API Endpoint Implementation Plan: /profiles/me (GET)

## 1. Przegląd punktu końcowego
Zwraca profil zalogowanego użytkownika.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: /profiles/me
- Parametry: brak

## 3. Wykorzystywane typy
- DTO: ProfileMeResponseDTO

## 3. Szczegóły odpowiedzi
- 200: ProfileMeResponseDTO
- 401: nieautoryzowany
- 404: brak profilu

## 4. Przepływ danych
1) SELECT `profiles` WHERE id=auth.uid().

## 5. Względy bezpieczeństwa
- RLS: tylko właściciel.

## 6. Obsługa błędów
- 401, 404 zgodnie z RLS.

## 7. Rozważania dotyczące wydajności
- Prosty SELECT.

## 8. Etapy wdrożenia
1) Implementacja GET handler.


# API Endpoint Implementation Plan: /profiles/me (PATCH)

## 1. Przegląd punktu końcowego
Aktualizacja `username` w profilu użytkownika.

## 2. Szczegóły żądania
- Metoda HTTP: PATCH
- Struktura URL: /profiles/me
- Parametry:
  - Wymagane: username
- Request Body: { username: string }

## 3. Wykorzystywane typy
- DTO: UpdateProfileCommand, UpdateProfileResponseDTO
- Command: UpdateProfileCommand

## 3. Szczegóły odpowiedzi
- 200: UpdateProfileResponseDTO
- 400: nieprawidłowy format/długość
- 409: konflikt unikalności
- 401: nieautoryzowany

## 4. Przepływ danych
1) Zod: walidacja (trim, długość 3–32, regex opcjonalnie).
2) UPDATE `profiles` SET username, updated_at automatycznie przez trigger.
3) Zwróć zaktualizowany rekord.

## 5. Względy bezpieczeństwa
- RLS: tylko właściciel może edytować.

## 6. Obsługa błędów
- Walidacja → 400.
- Unikalność → 409.

## 7. Rozważania dotyczące wydajności
- Pojedynczy UPDATE; indeks `profiles_username_lower_ux`.

## 8. Etapy wdrożenia
1) Zod schema UpdateProfileCommand.
2) Handler PATCH (Supabase z `context.locals`).


# API Endpoint Implementation Plan: /cards (POST)

## 1. Przegląd punktu końcowego
Ręczne tworzenie fiszki (`origin = "manual"`).

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /cards
- Parametry: brak
- Request Body: { front, back, source_snippet }

## 3. Wykorzystywane typy
- DTO: CreateCardCommand, CreateCardResponseDTO, CardDTO
- Command: CreateCardCommand

## 3. Szczegóły odpowiedzi
- 201: CreateCardResponseDTO
- 400: walidacja pól (trim, puste, za długie)
- 401: nieautoryzowany
- 500: błąd DB

## 4. Przepływ danych
1) Zod: walidacja pól, trim.
2) INSERT do `public.cards` z `owner_id = auth.uid()`, `origin = 'manual'`.
3) Zwróć pełny rekord.

## 5. Względy bezpieczeństwa
- RLS INSERT: WITH CHECK owner_id = auth.uid().

## 6. Obsługa błędów
- 400 na naruszenia walidacji.
- 500 na niespodziewane błędy.

## 7. Rozważania dotyczące wydajności
- Brak; pojedynczy insert.

## 8. Etapy wdrożenia
1) Zod schema CreateCardCommand.
2) Handler POST.


# API Endpoint Implementation Plan: /cards (GET)

## 1. Przegląd punktu końcowego
Lista fiszek użytkownika z paginacją i sortowaniem.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: /cards
- Parametry:
  - Opcjonalne: page (≥1), page_size (≤100), sort (created_at_asc|created_at_desc|due_at_asc), origin (manual|ai)

## 3. Wykorzystywane typy
- DTO: ListCardsQuery, ListCardsResponseDTO, PaginationDTO

## 3. Szczegóły odpowiedzi
- 200: ListCardsResponseDTO
- 400: błędne parametry paginacji
- 401: nieautoryzowany

## 4. Przepływ danych
1) Walidacja query przez Zod.
2) SELECT z `public.cards` WHERE owner_id=auth.uid(), filtry, ORDER BY, LIMIT/OFFSET.
3) Zwróć `data` oraz `pagination` (drugi SELECT count(*) dla total).

## 5. Względy bezpieczeństwa
- RLS SELECT.

## 6. Obsługa błędów
- 400 przy błędnych parametrach.

## 7. Rozważania dotyczące wydajności
- Indeksy: `cards_owner_created_id_ix`, `cards_owner_due_id_ix`.
- LIMIT i maksymalne page_size.

## 8. Etapy wdrożenia
1) Zod schema ListCardsQuery.
2) Handler GET.


# API Endpoint Implementation Plan: /cards/{id} (GET)

## 1. Przegląd punktu końcowego
Pobranie pojedynczej fiszki po UUID.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: /cards/{id}
- Parametry:
  - Wymagane: id (UUID)

## 3. Wykorzystywane typy
- DTO: GetCardResponseDTO

## 3. Szczegóły odpowiedzi
- 200: GetCardResponseDTO
- 401: nieautoryzowany
- 404: brak fiszki lub nie należy do użytkownika

## 4. Przepływ danych
1) Zod: walidacja id.
2) SELECT `cards` WHERE id=:id AND owner_id=auth.uid().

## 5. Względy bezpieczeństwa
- RLS SELECT.

## 6. Obsługa błędów
- 404 jeśli brak rekordu.

## 7. Rozważania dotyczące wydajności
- PK na id wystarcza.

## 8. Etapy wdrożenia
1) Zod schema dla id w ścieżce.
2) Handler GET.


# API Endpoint Implementation Plan: /cards/{id} (PATCH)

## 1. Przegląd punktu końcowego
Aktualizacja pól tekstowych fiszki; pola SM‑2 aktualizowane wyłącznie przez study API.

## 2. Szczegóły żądania
- Metoda HTTP: PATCH
- Struktura URL: /cards/{id}
- Parametry:
  - Wymagane: id (UUID)
  - Body: co najmniej jedno z [front, back, source_snippet], każde niepuste po trim

## 3. Wykorzystywane typy
- DTO: UpdateCardCommand, UpdateCardResponseDTO
- Command: UpdateCardCommand

## 3. Szczegóły odpowiedzi
- 200: UpdateCardResponseDTO
- 400: brak pól albo pola puste/whitespace
- 401: nieautoryzowany
- 404: fiszka nieznaleziona/nienależy

## 4. Przepływ danych
1) Zod: walidacja ciałą (co najmniej 1 pole, każde niepuste).
2) UPDATE `cards` SET front/back/source_snippet.
3) Zwróć pełny rekord.

## 5. Względy bezpieczeństwa
- RLS UPDATE.

## 6. Obsługa błędów
- 400, 404 zgodnie z regułami.

## 7. Rozważania dotyczące wydajności
- Jedno UPDATE; `updated_at` trigger.

## 8. Etapy wdrożenia
1) Zod schema UpdateCardCommand.
2) Handler PATCH.


# API Endpoint Implementation Plan: /cards/{id} (DELETE)

## 1. Przegląd punktu końcowego
Twarde usunięcie fiszki.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: /cards/{id}
- Parametry: id (UUID)

## 3. Wykorzystywane typy
- Brak body

## 3. Szczegóły odpowiedzi
- 204: No Content
- 401: nieautoryzowany
- 404: brak fiszki

## 4. Przepływ danych
1) DELETE FROM `cards` WHERE id=:id AND owner_id=auth.uid().

## 5. Względy bezpieczeństwa
- RLS DELETE.

## 6. Obsługa błędów
- 404: brak rekordu.

## 7. Rozważania dotyczące wydajności
- Operacja szybka; ON DELETE CASCADE dla powiązań (jeśli `card_reviews`).

## 8. Etapy wdrożenia
1) Handler DELETE.


# API Endpoint Implementation Plan: /ai/generate (POST)

## 1. Przegląd punktu końcowego
Generowanie propozycji fiszek z wklejonego tekstu przez OpenRouter, BEZ zapisu do DB.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /ai/generate
- Parametry:
  - Wymagane: input_text (string, niepuste po trim)
  - Opcjonalne: brak

## 3. Wykorzystywane typy
- DTO: GenerateCardsCommand, GenerateCardsResponseDTO, AICardProposalDTO
- Command: GenerateCardsCommand

## 3. Szczegóły odpowiedzi
- 200: { cards: AICardProposalDTO[], model: string, tokens_used }
- 400: puste/za długie input_text
- 401: nieautoryzowany
- 500: błąd usług AI

## 4. Przepływ danych
1) Zod: walidacja input_text + limit długości.
2) Call OpenRouter (model z konfiguracji), prompt sterujący generacją Basic cards, użyj source-snippet z tekstu.
3) Zwróć propozycje; brak DB write.

## 5. Względy bezpieczeństwa
- Rate limiting per user/IP (koszty AI).
- Ochrona przed prompt injection (nie kopiować wprost wrażliwych danych do promptów).

## 6. Obsługa błędów
- 400: przekroczony limit znaków lub pusty tekst.
- 500: provider error/timeout.

## 7. Rozważania dotyczące wydajności
- Możliwy streaming odpowiedzi; kontrola max input.

## 8. Etapy wdrożenia
1) Zod schema GenerateCardsCommand.
2) Integracja z OpenRouter.


# API Endpoint Implementation Plan: /ai/cards/batch (POST)

## 1. Przegląd punktu końcowego
Transakcyjny zapis całej partii wygenerowanych fiszek jako `origin='ai'`.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /ai/cards/batch
- Parametry:
  - Wymagane: cards[] (front, back, source_snippet – każde niepuste)
  - Opcjonalne: brak

## 3. Wykorzystywane typy
- DTO: SaveAICardsBatchCommand, SaveAICardsBatchResponseDTO, CardDTO
- Command: SaveAICardsBatchCommand

## 3. Szczegóły odpowiedzi
- 201: lista zapisanych CardDTO
- 400: walidacja (puste pola, pusty batch)
- 401: nieautoryzowany
- 500: błąd transakcji

## 4. Przepływ danych
1) Zod: walidacja całej tablicy.
2) RPC `insert_cards_batch(cards jsonb)` (lub pojedynczy INSERT w transakcji) z wymuszeniem owner_id=auth.uid(), origin='ai'.
3) Zwróć wstawione rekordy.

## 5. Względy bezpieczeństwa
- RLS, brak akceptacji owner_id z klienta.
- Rate limiting na zapisy batch.

## 6. Obsługa błędów
- 400 na walidację.
- 500 na błąd transakcji.

## 7. Rozważania dotyczące wydajności
- Jedna transakcja; `jsonb_to_recordset` dla dużych batchy.

## 8. Etapy wdrożenia
1) Zod schema SaveAICardsBatchCommand.
2) RPC w DB + handler POST.


# API Endpoint Implementation Plan: /study/due-cards (GET)

## 1. Przegląd punktu końcowego
Zwraca fiszki do powtórki, gdzie `due_at <= now()`.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: /study/due-cards
- Parametry:
  - Opcjonalne: limit (domyślnie 20, max 100), from_now (opcjonalne)

## 3. Wykorzystywane typy
- DTO: GetDueCardsQuery, GetDueCardsResponseDTO, StudyCardDTO

## 3. Szczegóły odpowiedzi
- 200: GetDueCardsResponseDTO (gdy lista pusta – cards: [])
- 401: nieautoryzowany

## 4. Przepływ danych
1) Walidacja query.
2) SELECT z indeksu `cards_owner_due_id_ix` WHERE owner_id=auth.uid() AND due_at<=now() ORDER BY (due_at,id) LIMIT.

## 5. Względy bezpieczeństwa
- RLS SELECT.

## 6. Obsługa błędów
- 401 gdy brak autoryzacji.

## 7. Rozważania dotyczące wydajności
- Użycie indeksu; mały payload (subset pól).

## 8. Etapy wdrożenia
1) Zod schema GetDueCardsQuery.
2) Handler GET.


# API Endpoint Implementation Plan: /study/review (POST)

## 1. Przegląd punktu końcowego
Przesłanie oceny (0–5) i aktualizacja stanu SM‑2 danej fiszki.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: /study/review
- Parametry:
  - Wymagane: card_id (UUID), grade (int 0–5)

## 3. Wykorzystywane typy
- DTO: SubmitReviewCommand, SubmitReviewResponseDTO
- Command: SubmitReviewCommand

## 3. Szczegóły odpowiedzi
- 200: SubmitReviewResponseDTO (subset pól SM‑2)
- 400: nieprawidłowe grade/format
- 401: nieautoryzowany
- 404: fiszka nieznaleziona/nienależy
- 500: błąd serwera

## 4. Przepływ danych
1) Zod: walidacja card_id i grade.
2) SELECT bieżących pól SM‑2.
3) Zastosuj algorytm SM‑2 (clamp EF do [1.3,3.0], aktualizacja interval/repetitions/due_at/last_reviewed_at).
4) UPDATE w transakcji; opcjonalnie INSERT do `card_reviews`.
5) Zwróć zaktualizowane SM‑2 subset.

## 5. Względy bezpieczeństwa
- RLS UPDATE; brak możliwości aktualizacji cudzej fiszki.

## 6. Obsługa błędów
- 400, 404, 500 w zależności od walidacji/istnienia/błędów.

## 7. Rozważania dotyczące wydajności
- Jedna transakcja; logic clamps zabezpieczają przed naruszeniem CHECK.

## 8. Etapy wdrożenia
1) Zod schema SubmitReviewCommand.
2) Service SM‑2 z deterministyczną implementacją i testami.
3) Handler POST.


# API Endpoint Implementation Plan: /health (GET)

## 1. Przegląd punktu końcowego
Prosty endpoint żywotności.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: /health
- Parametry: brak

## 3. Wykorzystywane typy
- DTO: HealthResponseDTO

## 3. Szczegóły odpowiedzi
- 200: { status: "ok", timestamp: ISODateString }

## 4. Przepływ danych
- Brak zależności; generuj timestamp serwerowy.

## 5. Względy bezpieczeństwa
- Publiczny; bez informacji wrażliwych.

## 6. Obsługa błędów
- 500 w razie nieoczekiwanego wyjątku.

## 7. Rozważania dotyczące wydajności
- Minimalny koszt.

## 8. Etapy wdrożenia
1) Handler GET.


# Wspólne aspekty: Przepływ danych, bezpieczeństwo, obsługa błędów, wydajność, kroki implementacji

## 4. Przepływ danych (ogólny)
- Astro Routes: używać `context.locals.supabase` (nie bezpośredniego klienta z `@supabase/supabase-js`).
- Walidacja wejścia: Zod schemy na każdy endpoint zgodnie z typami z `src/types.ts`.
- DB: RLS wymusza owner_id=auth.uid(). Nie przyjmować owner_id od klienta.
- AI: OpenRouter jako zewnętrzna usługa; brak zapisu w `/ai/generate`.

## 5. Względy bezpieczeństwa (ogólne)
- Autoryzacja: JWT od Supabase; 401 przy braku/wygaśnięciu.
- RLS: SELECT/INSERT/UPDATE/DELETE ograniczone do właściciela.
- Rate limiting: na `/auth/*`, `/ai/generate`, `/ai/cards/batch`.
- Walidacja danych: Zod + sanityzacja ciągów tekstowych (trim, długość, znaki).
- Ochrona przed injection: parametryzowane zapytania Supabase; brak raw SQL w handlerach.
- Unikanie wycieków: nie logować haseł/tokenów; w logach minimalne metadane.

## 6. Obsługa błędów (ogólna)
- 400: naruszenia walidacji Zod.
- 401: brak/niepoprawny token.
- 404: brak zasobu lub ukryty przez RLS.
- 409: konflikty unikalności (username/email) gdzie dotyczy.
- 500: błędy po stronie serwera/AI/DB.
- Logowanie: aplikacyjne logi (bez tabeli błędów w MVP); opcjonalnie zdarzenia metryczne (liczba wygenerowanych fiszek, zapisanych fiszek).

## 7. Rozważania dotyczące wydajności (ogólne)
- Indeksy: `cards_owner_due_id_ix`, `cards_owner_created_id_ix`, `profiles_username_lower_ux`.
- Paginacja: maks. page_size, domyślnie 20.
- Batch insert: transakcja + `jsonb_to_recordset`.
- AI: limit długości wejścia, ewentualny streaming.

## 8. Kroki implementacji (ogólne)
1) Utworzyć Zod schemy zgodne z typami z `src/types.ts` (Command/Query/DTO shape validation wejścia).
2) W warstwie routes (Astro) korzystać z `context.locals.supabase` i typu `SupabaseClient` z `src/db/supabase.client.ts`.
3) Wydzielić serwisy:
   - AuthService: register/login/logout/me (adaptacja do username→email mapowania).
   - ProfileService: get/update własnego profilu.
   - CardService: create/list/get/update/delete (tekstowe pola).
   - AIService: generate (OpenRouter), AIBatchService: batch save.
   - StudyService: dueCards, review (SM‑2 algorytm).
4) Zaimplementować SM‑2 jako czystą funkcję z testami jednostkowymi (clamp EF, reguły intervalów/repetitions).
5) Dodać rate limiting na wybrane endpointy (np. middleware lub reverse proxy).
6) Zaimplementować spójne mapowanie błędów na statusy i JSON z polem `error` + `message`.
7) Zweryfikować RLS polityki w Supabase oraz użycie kontekstu `auth.uid()` w RPC (dla batch insertów).
8) Przeprowadzić E2E testy kluczowych przepływów (register→create card→due-cards→review→list).
