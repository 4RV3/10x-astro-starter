# Specyfikacja techniczna modułu autentykacji (Auth) – FlashAI

Dokument opisuje architekturę modułu rejestracji, logowania, wylogowywania i odzyskiwania hasła z wykorzystaniem Astro 5, React 19, TypeScript 5, Tailwind 4, Shadcn/ui oraz Supabase Auth. Specyfikacja jest zgodna z PRD (`US-001`–`US-003`) oraz z regułami projektowymi.

> Uwaga: funkcje odzyskiwania hasła opisane w tym dokumencie wykraczają poza jawnie zdefiniowane User Stories w PRD, ale są zgodne z wymaganiami bezpieczeństwa (sekcja 3.8 PRD) i stanowią rozszerzenie MVP, nie zmieniając zachowania zdefiniowanego w PRD.

---

## 1. Architektura interfejsu użytkownika

### 1.1. Przegląd widoków i layoutów

#### 1.1.1. Layouty Astro

- `src/layouts/BaseLayout.astro`
  - Layout bazowy dla całej aplikacji.
  - Odpowiedzialność:
    - Ustawienie podstawowego `<html lang="pl">`, `<head>`, meta, globalne style (Tailwind, shadcn/ui).
    - Sekcja `<main role="main">` jako główny landmark ARIA.
    - Wspólne komponenty: globalny `Header`, `Footer`, region powiadomień/toastów.
  - Nie posiada logiki auth, tylko przyjmuje informację o stanie użytkownika (np. `user` lub `session`) jako props z warstwy stron Astro.

- `src/layouts/AuthLayout.astro`
  - Layout dedykowany dla stron auth (rejestracja, logowanie, reset hasła).
  - Odpowiedzialność:
    - Skupiony, prosty układ: panel formularza + obszar z copy/USP.
    - ARIA landmark `main`, sekcja `role="form"` otaczająca komponent formularza.
    - Obsługa nagłówka dla strony auth (logo, link do przełączenia logowanie ↔ rejestracja).
    - Dark mode wspierany Tailwindem (`dark:`).
  - Używany przez:
    - `/auth/register`
    - `/auth/login`
    - `/auth/reset-password`
    - `/auth/reset-password/confirm` (jeśli przewidujemy customowy flow z linkiem z maila po stronie UI).

- `src/layouts/AppLayout.astro`
  - Layout dla widoków wymagających zalogowania (np. dashboard, lista fiszek, generator AI, powtórki).
  - Odpowiedzialność:
    - Odczyt zalogowanego użytkownika z `Astro.locals` (sesja Supabase, z middleware).
    - Nawigacja aplikacji (sidebar/topbar) z elementami widocznymi tylko dla zalogowanych:
      - Linki do: “Moje fiszki”, “Generuj z AI”, “Powtórki”.
      - Przycisk “Wyloguj”.
    - ARIA:
      - `nav` z `aria-label="Główna nawigacja"`.
      - Wskazanie `aria-current="page"` dla aktywnego widoku.
    - Przekazanie `user` / `profile` jako props do stron.

> Layouty nie zmieniają istniejącego działania aplikacji – stanowią rozszerzalny szkielet, do którego można podpiąć obecne strony.

---

### 1.2. Strony Astro i routing

#### 1.2.1. Strony publiczne (non-auth)

- Przykład (niezależnie od obecnego stanu): 
  - `src/pages/index.astro` – landing / “empty state” dla niezalogowanych.
- Zmiany:
  - Dodanie CTA:
    - “Zarejestruj się” → `/auth/register`
    - “Zaloguj się” → `/auth/login`
  - Brak bezpośredniej logiki auth – jedynie linki.

#### 1.2.2. Strony auth

1. `src/pages/auth/register.astro`
   - Cel: Implementacja `US-001 – Rejestracja konta`.
   - Struktura:
     - Używa `AuthLayout.astro`.
     - Importuje komponent React `RegisterForm` (client-side).
     - SSR:
       - Jeśli użytkownik jest już zalogowany (sesja w `Astro.locals`), redirect do strony głównej aplikacji (np. `/app`).
   - Odpowiedzialności:
     - Render tytułu, opisu (copy), osadzenie komponentu formularza.
     - Komunikaty wynikowe (np. `?registered=1`) – przekazane z backendu / API, ale głównie logika po stronie React.

2. `src/pages/auth/login.astro`
   - Cel: Implementacja `US-002 – Logowanie`.
   - Struktura analogiczna do `register.astro`:
     - `AuthLayout.astro`.
     - React `LoginForm`.
     - SSR redirect dla już zalogowanych.
   - Dodatkowe elementy:
     - Link “Nie pamiętasz hasła?” → `/auth/reset-password`.

3. `src/pages/auth/reset-password.astro`
   - Cel: rozpoczęcie procesu odzyskiwania hasła (nie wymienione w US, ale konieczne “odzyskiwanie konta”).
   - Struktura:
     - `AuthLayout.astro`.
     - React `RequestPasswordResetForm`.
   - Użycie Supabase:
     - Wywołanie API, które wyśle mail resetujący (supabase `resetPasswordForEmail` lub `auth.admin.generateLink` w zależności od przyjętego flow – patrz sekcja 3).

4. `src/pages/auth/reset-password/confirm.astro` (opcjonalne, zależne od wybranego flow Supabase)
   - Jeżeli reset ma się odbywać wewnątrz aplikacji:
     - Odbiór `access_token` / `type=recovery` z URL (Supabase redirect).
     - SSR: utworzenie specjalnej sesji i osadzenie React `ResetPasswordForm` do ustawienia nowego hasła.
   - Jeśli wybieramy wbudowany UI Supabase dla resetu hasła – strona może nie być potrzebna.

#### 1.2.3. Strony wymagające zalogowania

- `src/pages/app/index.astro` (lub podobne, zależnie od istniejącego routera):
  - Wymagany zalogowany użytkownik (middleware + sprawdzenie sesji).
  - Jeśli brak sesji – redirect do `/auth/login` z parametrem `redirectTo=/app`.
- Inne strony biznesowe (lista fiszek, generator AI, powtórki) pozostają nietknięte w specyfikacji, ale:
  - Wymagają sesji (patrz middleware).
  - W nagłówku/nawigacji muszą mieć dostępny przycisk “Wyloguj”.

---

### 1.3. Komponenty React po stronie klienta

#### 1.3.1. Lokalizacja komponentów

- Wszystkie komponenty interaktywne auth:
  - `src/components/auth/RegisterForm.tsx`
  - `src/components/auth/LoginForm.tsx`
  - `src/components/auth/RequestPasswordResetForm.tsx`
  - `src/components/auth/ResetPasswordForm.tsx` (jeśli używamy wewnętrznego formularza zmiany hasła)
- Wspólne elementy UI z shadcn/ui:
  - `src/components/ui/input.tsx`
  - `src/components/ui/button.tsx`
  - `src/components/ui/form.tsx`
  - `src/components/ui/alert.tsx`
  - itp. – standardowy setup shadcn, ponownie używany.

#### 1.3.2. RegisterForm

- Plik: `src/components/auth/RegisterForm.tsx`
- Rola:
  - Formularz rejestracji z polami:
    - `username` (tekst – pole główne do logowania, zgodnie z PRD)
    - `email` (tekst – adres e‑mail wymagany przez Supabase Auth i do resetu hasła; nie jest używany do logowania w UI)
    - `password` (hasło)
    - `passwordConfirm` (hasło)
  - Walidacja client-side + integracja z API `/api/auth/register`.
- Odpowiedzialności:
  - Zbieranie danych z formularza.
  - Walidacja:
    - Wszystkie pola wymagane.
    - `password === passwordConfirm`.
    - (Opcjonalnie) minimalna długość hasła (np. 8 znaków) – zgodnie z Supabase constraints, jeśli istnieją.
  - Wysyłanie żądania `POST` do `src/pages/api/auth/register.ts`.
  - Obsługa stanów:
    - `loading` (disable przycisk, pokaż spinner).
    - Błędy walidacji (inline, pod polem).
    - Błędy API (np. username zajęty).
    - Sukces:
      - Zgodnie z PRD (US‑001) wybieramy konkretny wariant:
        - **Docelowo w MVP:** redirect do `/auth/login?registered=1` (bez automatycznego logowania).
        - Na stronie logowania pojawia się komunikat “Konto utworzone, możesz się zalogować”.
  - ARIA / dostępność:
    - Każde pole z `aria-describedby` wskazującym na komunikat błędu.
    - Główny komunikat błędu w `role="alert"` lub `aria-live="polite"`.

#### 1.3.3. LoginForm

- Plik: `src/components/auth/LoginForm.tsx`
- Rola:
  - Formularz logowania z polami:
    - `username` (pole logowania – zgodnie z PRD)
    - `password`
  - Walidacja client-side + API `/api/auth/login`.
- Odpowiedzialności:
  - Walidacja:
    - Pola wymagane.
  - Po sukcesie:
    - Redirect do:
      - `redirectTo` z query (np. `/app`), jeśli istnieje.
      - W przeciwnym razie – domyślny widok aplikacji.
  - Błędy:
    - Pojedynczy komunikat: “Nieprawidłowa nazwa użytkownika lub hasło” – bez ujawniania, czy konto istnieje (wymóg PRD).
    - Błędy sieci / serwera: komunikat ogólny “Wystąpił problem, spróbuj ponownie”.
  - Obsługa wygaśniętej sesji (US-005):
    - Jeśli użytkownik został przekierowany z chronionej strony z powodu wygaśniętej sesji, query param `reason=session_expired` → pokazanie komunikatu informacyjnego nad formularzem.

#### 1.3.4. RequestPasswordResetForm

- Plik: `src/components/auth/RequestPasswordResetForm.tsx`
- Rola:
  - Formularz przyjmujący adres e‑mail użytkownika używany przez Supabase jako identyfikator do wysyłki maila resetującego.
  - **Istotne:** mimo że PRD definiuje logowanie po `username`, na poziomie technicznym wprowadzamy dodatkowe pole `email` przy rejestracji. Logowanie w UI odbywa się wyłącznie przy użyciu `username` + `password`, natomiast `email` jest używany:
    - przez Supabase Auth jako identyfikator konta,
    - w procesie resetu hasła.
  - Formularz resetu:
    - Pole `email` (używane przez Supabase do wysyłki maila resetującego).
- Odpowiedzialności:
  - Walidacja:
    - `email` wymagany, format e‑mail.
  - Po sukcesie:
    - Komunikat: “Jeżeli konto istnieje, wysłaliśmy instrukcje zmiany hasła na podany adres e‑mail.”
    - Nie ujawnia, czy konto istnieje.
  - API:
    - Wywołanie `POST /api/auth/request-password-reset`.

#### 1.3.5. ResetPasswordForm (opcjonalne)

- Plik: `src/components/auth/ResetPasswordForm.tsx`
- Używane, gdy Supabase przekierowuje do naszej aplikacji z tokenem.
- Pola:
  - `newPassword`
  - `newPasswordConfirm`
- Odpowiedzialności:
  - Walidacja:
    - Oba pola wymagane.
    - Równość haseł.
  - Po sukcesie:
    - Komunikat o sukcesie oraz redirect na `/auth/login`.

---

### 1.4. Rozdział odpowiedzialności: Astro vs React

- **Astro (strony + layouty)**:
  - Routing, SSR (sprawdzanie sesji, redirect logowania/wylogowywania).
  - Wstrzykiwanie danych sesji do `Astro.locals` i propsów layoutu.
  - Wykorzystanie `Astro.cookies` dla ewentualnych flag UI (np. info o wygaśnięciu sesji).
- **React (komponenty)**:
  - Obsługa interakcji użytkownika, walidacja na froncie, stany `loading`/`error`/`success`.
  - Wołanie endpointów API (warstwa backendowa w `src/pages/api`).
  - Prezentacja i obsługa błędów zwracanych z backendu (komunikaty przyjazne użytkownikowi).

---

### 1.5. Scenariusze i walidacja / komunikaty błędów

#### 1.5.1. Rejestracja (US-001)

- Scenariusz szczęśliwy:
  1. Użytkownik przechodzi na `/auth/register`.
  2. Wprowadza `username`, `email`, `password`, `passwordConfirm`.
  3. Walidacja client-side przechodzi.
  4. Front wysyła `POST /api/auth/register`.
  5. Backend:
     - Tworzy użytkownika w Supabase Auth.
     - Tworzy rekord profilu z unikalnym `username`.
  6. Backend zwraca sukces.
  7. Front:
     - **Wybór dla MVP:** redirectuje do `/auth/login?registered=1` (bez automatycznego logowania), spełniając warunek PRD “zalogowany lub przekierowany do logowania z jasnym komunikatem sukcesu”.
- Walidacja client-side:
  - Puste pola → komunikat: “To pole jest wymagane”.
  - Hasła różne → “Hasła muszą być zgodne”.
- Walidacja server-side (Zod):
  - Analogiczna do client-side + dodatkowe sprawdzenia (np. minimalna długość).
- Błędy domenowe:
  - Username zajęty → “Ta nazwa użytkownika jest już zajęta”.

#### 1.5.2. Logowanie (US-002)

- Scenariusz szczęśliwy:
  1. `/auth/login` – użytkownik wpisuje `username` + `password`.
  2. Client waliduje obecność pól.
  3. Request `POST /api/auth/login`.
  4. Backend:
     - Na podstawie `username` znajduje powiązany `user_id`/`email` w tabeli profilu.
     - Wywołuje Supabase `signInWithPassword`.
     - Ustala cookie sesji (poprzez mechanizm Supabase + Astro middleware).
  5. Odpowiedź success.
  6. Front robi redirect do `redirectTo` lub `/app`.
- Błędy:
  - Niepoprawny login/hasło → zawsze ten sam komunikat ogólny, bez zdradzania, czy `username` istnieje.
  - Błąd serwera (np. problemy z Supabase) → “Wystąpił błąd po naszej stronie. Spróbuj ponownie.”

#### 1.5.3. Wylogowanie (US-003)

- UI:
  - Przycisk “Wyloguj” w `AppLayout`.
- Scenariusz:
  1. Kliknięcie “Wyloguj” wysyła `POST /api/auth/logout`.
  2. Backend:
     - Wywołuje `supabase.auth.signOut()` dla danej sesji.
     - Czyści cookie sesyjne.
  3. Front:
     - Po 200 OK – redirect do `/auth/login` lub `/`.
- Dodatkowo:
  - Próba wejścia na widok wymagający auth po wylogowaniu → redirect do `/auth/login`.

#### 1.5.4. Obsługa wygaśniętej sesji (US-005)

- Middleware:
  - Sprawdza ważność sesji na wejściu na chronione ścieżki (np. `/app/**`).
  - Jeśli brak sesji lub wygasła:
    - Redirect do `/auth/login?reason=session_expired&redirectTo=...`.
- LoginForm:
  - Odczytuje `reason=session_expired` i wyświetla informację: “Twoja sesja wygasła. Zaloguj się ponownie.”

---

## 2. Logika backendowa

### 2.1. Struktura endpointów API

Wszystkie endpointy w `src/pages/api`, zgodnie z konwencją Astro. Każdy plik ustawia `export const prerender = false`.

1. `src/pages/api/auth/register.ts`
   - Metody:
     - `POST` – rejestracja nowego użytkownika.
   - Wejście (JSON DTO):
     - `username: string`
     - `email: string` (identyfikator konta w Supabase, wymagany technicznie, ale nie używany do logowania w UI)
     - `password: string`
   - Wyjście:
     - 201 + minimalne informacje o użytkowniku (bez hasła) lub puste `{}`.
     - 400 dla błędów walidacji.
     - 409 gdy `username` zajęty.
     - 500 dla błędów serwera.
   - Uwagi:
     - Używa `supabase` z `context.locals` (nie importuje klienta bezpośrednio).
     - Tworzy użytkownika w Supabase Auth (`auth.signUp`).
     - Tworzy rekord w tabeli `profiles` z `username` i `user_id`.

2. `src/pages/api/auth/login.ts`
   - Metody:
     - `POST` – logowanie.
   - Wejście:
     - `username: string` (główne pole logowania, zgodnie z PRD)
     - `password: string`
   - Wyjście:
     - 200 przy sukcesie.
     - 401 przy błędnych danych.
     - 400 przy błędach walidacji.
   - Działanie:
     - Znalezienie maila (`email`) powiązanego z `username` w tabeli `profiles`.
     - `supabase.auth.signInWithPassword({ email, password })`.
     - Zwrócenie wyniku, upewniając się, że cookie sesyjne jest poprawnie skonfigurowane (po stronie Supabase + middleware).

3. `src/pages/api/auth/logout.ts`
   - Metody:
     - `POST` – wylogowanie bieżącej sesji.
   - Działanie:
     - `supabase.auth.signOut()`.
     - Wyczyści cookie sesji.
   - Wyjście:
     - 200 lub 204 przy sukcesie.
     - 401, jeżeli nie ma aktywnej sesji (opcjonalne).

4. `src/pages/api/auth/request-password-reset.ts`
   - Metody:
     - `POST`.
   - Wejście:
     - `email: string` (lub `username`, jeśli zdecydujemy się na mapowanie username→email).
   - Działanie:
     - `supabase.auth.resetPasswordForEmail(email, { redirectTo: <nasz URL> })`.
   - Wyjście:
     - 200 zawsze przy poprawnym wejściu z informacją “jeśli konto istnieje, mail zostanie wysłany”.

5. `src/pages/api/auth/reset-password.ts` (tylko przy własnym UI do zmiany hasła)
   - Metody:
     - `POST`.
   - Wejście:
     - `newPassword: string`
   - Działanie:
     - Wymaga, by żądanie było uwierzytelnione specjalną sesją “recovery”, którą Supabase tworzy po kliknięciu w maila.
     - `supabase.auth.updateUser({ password: newPassword })`.
   - Wyjście:
     - 200 przy sukcesie, 400/401/500 przy błędach.

---

### 2.2. Modele danych i typy

#### 2.2.1. Wspólne typy (`src/types.ts`)

- DTO dla auth:
  - `RegisterRequestDto` – zawiera `username`, `email`, `password`.
  - `RegisterResponseDto`
  - `LoginRequestDto` – zawiera `username`, `password`.
  - `LoginResponseDto`
  - `RequestPasswordResetDto`
  - `ResetPasswordDto`
- Typy dla użytkownika:
  - `UserProfile` – reprezentacja danych z tabeli `profiles` współdzielona między frontendem i backendem.

#### 2.2.2. Tabela `profiles` (DB)

- Pola minimalne:
  - `id` (PK)
  - `user_id` (FK do `auth.users`)
  - `username` (unikalny, znormalizowany, np. `citext` + unique index)
  - `created_at`
  - `updated_at`
- Constrainty:
  - Unikalność `lower(username)`.
- RLS:
  - Tylko właściciel (`auth.uid() = user_id`) ma dostęp.

---

### 2.3. Walidacja danych wejściowych (Zod)

- Lokalizacja schematów:
  - `src/lib/validation/auth.schemas.ts`
- Przykładowe schematy:
  - `registerSchema`
    - `username`: non-empty, np. min 3 znaki, tylko dopuszczalne znaki.
    - `email`: e-mail (wymagany; wykorzystywany technicznie, nie do logowania).
    - `password`: min długość (np. 8), wymogi złożoności, jeśli potrzebne.
  - `loginSchema`
    - `username`: non-empty (logowanie zawsze po nazwie użytkownika).
    - `password`: non-empty.
  - `requestPasswordResetSchema`
    - `email`: e-mail.
  - `resetPasswordSchema`
    - `newPassword`: jak w `password`.

- Każdy endpoint API:
  - Na początku funkcji:
    - Próba `schema.parseAsync(requestBody)`.
    - W razie błędu – 400 z opisem pól (przyjazny komunikat, mapowany na UI).

---

### 2.4. Obsługa wyjątków i logowanie

- Warstwa usługowa (service layer) w `src/lib/services/auth.service.ts`:
  - Funkcje:
    - `registerUser`
    - `loginUser`
    - `logoutUser`
    - `requestPasswordReset`
    - `resetPassword`
  - Każda funkcja:
    - Interakcja z Supabase.
    - Rzucanie błędów domenowych (np. `UsernameTakenError`, `InvalidCredentialsError`) jako dedykowane klasy.
- Endpointy API:
  - `try { await authService.registerUser(...) } catch (error) { ... }`
  - Mapowanie typu błędu na kod HTTP i “bezpieczny” komunikat.
- Logowanie:
  - Błędy krytyczne / nieoczekiwane:
    - Log do serwera (np. `console.error` + integracja z przyszłym systemem logowania).
  - Komunikaty dla użytkownika:
    - Ogólne, bez ujawniania zbyt wielu szczegółów.

---

### 2.5. Renderowanie server-side i astro.config

- `@astro.config.mjs`:
  - Zakładamy konfigurację SSR (np. adapter node/deno).
  - Auth wymaga SSR, by:
    - Middleware mógł odczytać i wstrzyknąć sesję Supabase.
    - Możliwa była ochrona stron (redirecty na poziomie serwera).
- Strony:
  - `export const prerender = false` dla widoków, które zależą od stanu sesji (np. `/app/**`, `/auth/reset-password/confirm`).
  - Auth strony: `register`, `login`:
    - Mogą być SSR bez prerenderu, bo ich zachowanie zależy od sesji (redirect zalogowanych).

---

## 3. System autentykacji – integracja z Supabase Auth

### 3.1. Supabase klient i kontekst

- `src/db/supabase.client.ts`:
  - Eksportuje typ `SupabaseClient` używany w typowaniu `Astro.locals`.
- Middleware: `src/middleware/index.ts`
  - Zadania:
    - Odczytać ciasteczka Supabase z żądania.
    - Utworzyć klienta Supabase z kontekstem żądania (URL, headers, cookies).
    - Pobrać bieżącą sesję (`getSession`).
    - Ustawić w `locals`:
      - `supabase: SupabaseClient`
      - `session` (obiekt sesji lub `null`)
      - ewentualnie `user` / `profile` (pobranie z DB raz na żądanie).
    - Wymusić auth dla wybranych ścieżek:
      - Jeśli ścieżka zaczyna się od `/app` i brak sesji → redirect na `/auth/login?reason=session_expired&redirectTo=<ścieżka>`.

---

### 3.2. Rejestracja z Supabase Auth

- `auth.service.registerUser`:
  1. Sprawdza, czy `username` jest wolny (SELECT z `profiles`).
  2. Wywołuje `supabase.auth.signUp({ email, password })`.
     - `email` jest rzeczywistym adresem e‑mail z formularza rejestracji; służy jako identyfikator użytkownika w Supabase oraz w procesie resetu hasła, ale nie jest używany do logowania w UI.
  3. Po sukcesie:
     - Zapisuje `profiles` row:
       - `user_id` = `auth.user.id`
       - `username` = `username`.

---

### 3.3. Logowanie z Supabase Auth

- `auth.service.loginUser`:
  1. Z `username` → SELECT `email` z `profiles`.
  2. `supabase.auth.signInWithPassword({ email, password })`.
  3. W przypadku błędnych poświadczeń:
     - Zwraca `InvalidCredentialsError`.
  4. Supabase automatycznie zarządza cookie sesyjnym (w zależności od sposobu integracji; w Astro typowo przez `createServerClient` z `@supabase/ssr` i przekazywanie `cookies` reader/writer).

---

### 3.4. Wylogowanie

- `auth.service.logoutUser`:
  - `supabase.auth.signOut()` z klientem skonfigurowanym per żądanie (middleware).
  - Czyści sesję w Supabase i pliki cookie.

---

### 3.5. Odzyskiwanie hasła

- `auth.service.requestPasswordReset`:
  - `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<APP_URL>/auth/reset-password/confirm' })`.
  - Brak ujawniania istnienia konta – błąd “user not found” mapujemy na sukces UI.
- `auth.service.resetPassword` (dla wewnętrznego UI):
  - Zakłada, że żądanie pochodzi z sesji typu `recovery` (Supabase ustawia ją po kliknięciu w link w mailu).
  - `supabase.auth.updateUser({ password: newPassword })`.

---

### 3.6. Integracja z nawigacją i akcjami użytkownika

- **Rejestracja**:
  - Po sukcesie – automatyczny login lub redirect do loginu.
- **Logowanie**:
  - Po sukcesie – redirect do `redirectTo` (jeśli istnieje) albo `/app`.
- **Wylogowanie**:
  - Przycisk w nagłówku / sidebarze (AppLayout).
  - Po kliknięciu – `POST /api/auth/logout`, następnie redirect.
- **Ochrona widoków**:
  - Middleware oraz opcjonalne guardy po stronie Astro (w `get`/`post` handlerach stron SSR) sprawdzają `locals.session`.

---

### 3.7. Bezpieczeństwo

- Hasła:
  - Nie są przechowywane w aplikacji – cały mechanizm hashowania obsługuje Supabase Auth (PRD: “NOTE: przechowywanie haseł jako hash jest odpowiedzialnością Supabase Auth”).
- RLS:
  - Dane profilowe i fiszki zabezpieczone przez RLS oparte o `auth.uid()`.
- Endpointy:
  - `/api/auth/*` akceptują tylko odpowiednie metody (np. `POST`).
  - Walidacja wejścia z Zod, ochrona przed invalid payload.
- Sesje:
  - Obsługa wygaśnięcia poprzez middleware i parametry `reason=session_expired`.

---

## 4. Podsumowanie

Specyfikacja definiuje:

- Nowe layouty (`AuthLayout`, `AppLayout`) i rozszerzenie `BaseLayout`.
- Strony Astro dla auth (`/auth/register`, `/auth/login`, `/auth/reset-password`, opcjonalnie `/auth/reset-password/confirm`).
- Komponenty React dla formularzy auth z pełną walidacją i obsługą błędów.
- Backendowe endpointy API w `src/pages/api/auth/*` oparte na Zod i serwisie `auth.service`.
- Integrację z Supabase Auth (rejestracja, logowanie, wylogowanie, reset hasła) z wykorzystaniem `SupabaseClient` z `src/db/supabase.client.ts` oraz middleware `src/middleware/index.ts`.
- Spójne scenariusze UX zgodne z PRD (US-001–US-003 + rozszerzenie o odzyskiwanie konta) bez naruszania istniejącego działania aplikacji.

Dokument stanowi podstawę do implementacji modułu auth w kolejnych krokach.
