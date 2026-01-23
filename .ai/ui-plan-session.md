# Architektura UI dla FlashAI (MVP)

## 1. Przegląd struktury UI

Aplikacja składa się z dwóch głównych „powłok”:

1. **Strefa niezalogowana (publiczna)**  
   - Ekrany: logowanie, rejestracja, ew. prosty landing.  
   - Brak głównego layoutu aplikacji, proste formularze auth.

2. **Strefa zalogowana (główny layout aplikacji)**  
   - Jeden wspólny layout (mobile-first) z:
     - topbarem (logo/nazwa, aktualny użytkownik, przycisk wylogowania),
     - nawigacją główną (sidebar na desktop, dolny pasek / rozwijane menu na mobile).
   - Sekcje odpowiadają głównym domenom z PRD i API:
     - **Powtórki** – `/study`
     - **Fiszki (lista + CRUD)** – `/cards`, `/cards/new`, `/cards/:id`, `/cards/:id/edit`
     - **Generator AI** – `/ai/generate`
     - **Dodaj ręcznie** – alias do `/cards/new`
     - **Profil** – `/profile`

Domyślny redirect po zalogowaniu: **`/study` → widok powtórek (due-cards)**.  
Cała komunikacja z backendem przechodzi przez wspólną warstwę fetch / TanStack Query, z globalną obsługą `401` (czyszczenie sesji, redirect do `/login`).

---

## 2. Lista widoków

### 2.1. Widok: Logowanie

- **Ścieżka widoku**: `/login`
- **Główny cel**: Umożliwić użytkownikowi zalogowanie się nazwą użytkownika i hasłem.
- **Kluczowe informacje do wyświetlenia**:
  - Formularz z polami:
    - `username`
    - `password`
  - Link/CTA do rejestracji (`/register`).
  - Komunikaty błędów walidacji i błędów auth (401).
- **Kluczowe komponenty widoku**:
  - Formularz loginu z walidacją po blur/submit.
  - Przycisk „Zaloguj”.
  - Link tekstowy „Nie masz konta? Zarejestruj się”.
  - Globalny komponent błędu ogólnego (np. toast) dla nieprzewidzianych 5xx.
- **UX, dostępność i względy bezpieczeństwa**:
  - Po sukcesie – redirect do `/study`.
  - Przy błędnych danych – komunikat ogólny „Nieprawidłowa nazwa użytkownika lub hasło” (bez ujawniania, czy konto istnieje).
  - Zabezpieczenie przed wielokrotnym klikaniem – disabled przycisk w trakcie requestu.
  - Formularz powinien umożliwiać submit klawiszem Enter.

---

### 2.2. Widok: Rejestracja

- **Ścieżka widoku**: `/register`
- **Główny cel**: Założenie nowego konta z username, emailem i hasłem.
- **Kluczowe informacje do wyświetlenia**:
  - Formularz z polami:
    - `email`
    - `username`
    - `password`
    - `confirmPassword`
  - Informacja o podstawowych zasadach username (długość/znaki – skrótowo).
- **Kluczowe komponenty widoku**:
  - Formularz rejestracji.
  - Przycisk „Załóż konto”.
  - Link „Masz już konto? Zaloguj się” (do `/login`).
- **UX, dostępność i względy bezpieczeństwa**:
  - Po sukcesie: albo automatyczne zalogowanie (redirect `/study`), albo komunikat sukcesu + CTA do loginu (w zależności od implementacji backendu).
  - Błędy:
    - 400 (niepoprawne dane) → komunikaty pod odpowiednimi polami.
    - 409 (username lub email zajęty) → komunikat przy danym polu.
  - Maskowanie pola hasła, brak logowania hasła w logach UI.

---

### 2.3. Główny layout zalogowany

- **Ścieżka widoku**: wrapper dla wszystkich `/study`, `/cards`, `/ai`, `/profile`
- **Główny cel**: Zapewnienie spójnej nawigacji i ram dla wszystkich widoków aplikacji.
- **Kluczowe informacje do wyświetlenia**:
  - Logo/nazwa „FlashAI”.
  - Nazwa użytkownika (z profilu).
  - Linki / ikony do sekcji:
    - Powtórki
    - Fiszki
    - Generator AI
    - Dodaj ręcznie
    - Profil
    - Wyloguj
- **Kluczowe komponenty widoku**:
  - **Topbar**:
    - Logo
    - Nazwa użytkownika (z `/profiles/me` lub danych auth).
    - Ikona/profil + menu rozwijane (na mobile).
  - **Sidebar / główna nawigacja** (desktop):
    - Lista przycisków / linków do sekcji (z wyróżnieniem aktywnej trasy).
  - **Dolny pasek / menu burger** (mobile):
    - Skróty do najważniejszych sekcji (Powtórki, Fiszki, AI, Profil).
  - **Obszar treści**:
    - Renderuje zawartość aktualnego widoku.
  - **Globalne toasty**:
    - Prezentacja błędów/sukcesów w tle.
- **UX, dostępność i względy bezpieczeństwa**:
  - Globalny handler `401`: w razie utraty sesji – komunikat toast „Sesja wygasła” + redirect do `/login`.
  - Brak linków do widoków, które wymagają danych spoza domeny zalogowanego użytkownika.
  - Widoczny przycisk „Wyloguj” (po kliknięciu: POST `/auth/logout` + wyczyszczenie lokalnego stanu + redirect do `/login`).

---

### 2.4. Widok: Powtórki SM-2 – sesja

- **Ścieżka widoku**: `/study` (alias `/study/due-cards`)
- **Główny cel**: Umożliwić użytkownikowi wykonywanie powtórek według SM-2 nad kartami „due”.
- **Kluczowe informacje do wyświetlenia**:
  - Aktualna fiszka:
    - `front` (pytanie)
    - Po odsłonięciu: `back` (odpowiedź)
    - Po dodatkowej akcji: `source_snippet` (fragment źródła).
  - Ocena odpowiedzi (skala 0–5).
  - Info o liczbie kart pozostałych (opcjonalnie).
  - Pusty stan, gdy brak fiszek do powtórek:
    - Tekst „Brak fiszek do powtórki”.
    - CTA: „Wygeneruj fiszki z tekstu” → `/ai/generate`.
    - CTA: „Dodaj fiszkę ręcznie” → `/cards/new`.
- **Kluczowe komponenty widoku**:
  - Kontener „karta powtórki”:
    - Sekcja „front”.
    - Przycisk „Pokaż odpowiedź”.
    - Po kliknięciu: sekcja „back” + przyciski ocen.
  - Przyciski oceny (0–5):
    - Wygodne, dobrze rozróżnione (np. trzy grupy: słabo/średnio/dobrze).
    - Wywołują POST `/study/review`.
  - Przycisk/odsyłacz „Pokaż źródło”:
    - Rozwijany panel z `source_snippet`.
  - Pasek stanu/loader (w trakcie ładowania kolejnej fiszki).
  - Pusty stan (komponent).
- **UX, dostępność i względy bezpieczeństwa**:
  - Ekran startowy po zalogowaniu – minimalne tarcie do rozpoczęcia powtórek.
  - Dbałość, by kliknięcie ocen nie było możliwe przed odsłonięciem back (jeżeli taka logika jest pożądana).
  - Przy błędzie `/study/due-cards`:
    - Komunikat globalny (toast) + przycisk „Spróbuj ponownie”.
  - Przy błędzie `/study/review` (5xx):
    - Toast z możliwością ponowienia oceny (lub przejścia do kolejnej fiszki w trybie „pominięto”).

---

### 2.5. Widok: Lista fiszek

- **Ścieżka widoku**: `/cards`
- **Główny cel**: Przegląd i zarządzanie wszystkimi fiszkami użytkownika.
- **Kluczowe informacje do wyświetlenia**:
  - Lista fiszek (paginowana):
    - `front` (skrót, np. pierwsze X znaków).
    - Etykieta `origin` (`AI` / `Manual`).
    - `created_at` (skrócony format).
    - `due_at` (opcjonalnie).
  - Filtry:
    - `origin`: Wszystkie / AI / Manual.
    - Sortowanie: `created_at_desc` (domyślnie), `created_at_asc`.
  - Paginacja:
    - Desktop: numery stron lub „Poprzednia / Następna”.
    - Mobile: przycisk „Załaduj więcej”.
- **Kluczowe komponenty widoku**:
  - Pasek filtrów/sortowania (nad listą).
  - Lista elementów:
    - Każda fiszka jako „row card” z:
      - Tytuł (front – skrót).
      - Tag „AI” lub „Manual”.
      - Przyciski:
        - „Podgląd / Edycja” → `/cards/:id`.
        - Ikona kosza „Usuń”.
  - Kontrolka paginacji (przycisk „Load more” na mobile).
  - Potwierdzenie usunięcia (modal / dialog).
- **UX, dostępność i względy bezpieczeństwa**:
  - Usuwanie:
    - Wymaga potwierdzenia przed wywołaniem DELETE `/cards/:id`.
    - Po sukcesie – odświeżenie listy / lokalne usunięcie elementu.
  - Duże listy:
    - Lazy loading / pagination; brak zaawansowanych filtrów w MVP.
  - Pusty stan:
    - Gdy lista pusta – komunikat + CTA do `/ai/generate` i `/cards/new`.

---

### 2.6. Widok: Szczegóły fiszki + edycja

- **Ścieżka widoku**: `/cards/:id`
- **Główny cel**: Podgląd pełnej treści fiszki i możliwość edycji front/back/source_snippet.
- **Kluczowe informacje do wyświetlenia**:
  - `front`
  - `back`
  - `source_snippet`
  - Metadane (readonly, opcjonalnie):
    - `origin`
    - `created_at`, `updated_at`
    - `due_at`, `repetitions`, `ease_factor` (tylko podgląd, bez edycji)
- **Kluczowe komponenty widoku**:
  - Tryb podglądu:
    - Sekcje z wyświetloną treścią front/back/source_snippet.
    - Przyciski „Edytuj” i „Usuń”.
  - Tryb edycji:
    - Formularz z polami:
      - `front` (textarea/input)
      - `back` (textarea/input)
      - `source_snippet` (textarea)
    - Przycisk „Zapisz zmiany”.
    - Przycisk „Anuluj” (powrót do podglądu).
  - Dialog potwierdzenia usunięcia.
- **UX, dostępność i względy bezpieczeństwa**:
  - Walidacja:
    - Wszystkie pola muszą być niepuste (trim).
    - Błędy 400/422 mapowane do komunikatów przy polach.
  - Po udanym zapisie:
    - Informacja o sukcesie (toast).
    - Aktualizacja widoku i ewentualne odświeżenie listy w tle.
  - Jeśli fiszka nie istnieje / nie należy do użytkownika:
    - Widok błędu 404 (informacja, że fiszka nie została znaleziona; link do `/cards`).

---

### 2.7. Widok: Tworzenie fiszki ręcznej

- **Ścieżka widoku**: `/cards/new`
- **Główny cel**: Szybkie dodanie pojedynczej fiszki manualnie.
- **Kluczowe informacje do wyświetlenia**:
  - Formularz z polami:
    - `front` (pytanie)
    - `back` (odpowiedź)
    - `source_snippet` (kontekst / fragment źródła; informacja, że może być np. „Brak”, ale nie może być puste).
- **Kluczowe komponenty widoku**:
  - Formularz tworzenia:
    - Pola tekstowe (textarea / input).
    - Przycisk „Zapisz fiszkę”.
    - Przycisk „Anuluj” (powrót do `/cards`).
- **UX, dostępność i względy bezpieczeństwa**:
  - Walidacja:
    - Puste / whitespace-only → komunikaty o brakujących polach.
    - Błędy 400 → mapowane do pól.
  - Po sukcesie:
    - Redirect do `/cards` lub informacja „Fiszka utworzona” + CTA „Dodaj kolejną” / „Przejdź do listy”.

---

### 2.8. Widok: Generator AI

- **Ścieżka widoku**: `/ai/generate`
- **Główny cel**: Umożliwić wklejenie materiału tekstowego, wygenerowanie fiszek AI, obejrzenie wyników i zapis całej paczki.
- **Kluczowe informacje do wyświetlenia**:
  - Pole textarea na **wejściowy tekst** (brak limitów produktowych; techniczny limit sygnalizowany przy 413).
  - Przyciski:
    - „Generuj fiszki” – POST `/ai/generate`.
  - Stan „generowanie”:
    - Loader, blokada przycisku.
  - Stan „wyniki”:
    - Lista wygenerowanych fiszek:
      - front
      - back
      - source_snippet
    - Przyciski:
      - „Zapisz wszystkie” – POST `/ai/cards/batch`.
      - „Odrzuć wyniki” – czyszczenie lokalnego stanu wyników.
  - Ostrzeżenie:
    - Tekst w stylu „Zweryfikuj fiszki z materiałem źródłowym. AI może popełniać błędy.”
- **Kluczowe komponenty widoku**:
  - **Strefa wejściowa**:
    - Duże textarea (mobile: pełna szerokość; desktop: kolumna lewa).
    - Przycisk „Generuj fiszki”.
  - **Strefa wyników**:
    - Blok informujący o braku wygenerowanych fiszek (gdy stan pusty).
    - Lista kart-propozycji:
      - Każda karta w prostym layoucie: front, back, źródło (np. w akordeonie).
    - Przyciski „Zapisz wszystkie” i „Odrzuć wyniki”.
  - Globalne toasty:
    - Dla błędów 500/503 przy `/ai/generate` i `/ai/cards/batch`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Trzy stany:
    1. **Początkowy** – wklejenie tekstu, przycisk „Generuj”.
    2. **Generowanie** – disabled przycisk, loader, brak możliwości opuszczenia widoku bez ostrzeżenia (jeśli już są wyniki).
    3. **Wyniki** – wyświetlenie fiszek, możliwość zapisu lub odrzucenia.
  - Błędy:
    - 400 / 413: komunikat pod textarea (zachowanie wklejonego tekstu).
    - 503: specjalny komunikat z CTA „Spróbuj ponownie później”, zachowanie tekstu.
    - 401: globalny handler → redirect do `/login`.
  - Ochrona przed utratą wyników:
    - Jeżeli użytkownik próbuje przejść do innej trasy / odświeżyć, a są **niezapisane** wyniki – ostrzeżenie (np. native `beforeunload` / dialog).
  - Zapis paczki:
    - Po „Zapisz wszystkie” i sukcesie – toast sukcesu + opcjonalny redirect do `/study` lub `/cards`.

---

### 2.9. Widok: Profil użytkownika

- **Ścieżka widoku**: `/profile`
- **Główny cel**: Podgląd i edycja `username`.
- **Kluczowe informacje do wyświetlenia**:
  - Obecne:
    - `username`
    - `email` (opcjonalnie, z auth, tylko readonly)
  - Formularz zmiany `username`.
- **Kluczowe komponenty widoku**:
  - Sekcja „Dane konta”:
    - Pole tekstowe z aktualnym username (do edycji).
    - Przyciski:
      - „Zapisz zmiany”.
  - Komunikaty walidacji:
    - Format/length.
    - 409 – nazwa zajęta.
- **UX, dostępność i względy bezpieczeństwa**:
  - Po sukcesie – toast „Zaktualizowano nazwę użytkownika”.
  - Zmiana username nie powinna zrywać sesji.
  - Brak funkcjonalności usuwania konta w MVP.

---

### 2.10. Widok: Stan pustego konta (pierwsze uruchomienie)

- **Ścieżka widoku**: stan w obrębie `/study` i/lub `/cards`
- **Główny cel**: Pokierować nowego użytkownika, który nie ma jeszcze żadnych fiszek.
- **Kluczowe informacje do wyświetlenia**:
  - Komunikat typu:
    - „Nie masz jeszcze żadnych fiszek.”
  - CTA:
    - „Wygeneruj fiszki z tekstu” → `/ai/generate`.
    - „Dodaj fiszkę ręcznie” → `/cards/new`.
- **Kluczowe komponenty widoku**:
  - Komponent pustego stanu (ikonka, tekst, dwa przyciski).
- **UX, dostępność i względy bezpieczeństwa**:
  - Ten stan pojawia się:
    - gdy lista `/cards` jest pusta,
    - albo gdy w `/study` nie ma kart *i* system wykryje, że nie ma żadnych kart (opcjonalnie).
  - Umożliwia natychmiastowe wejście w główne flows tworzenia fiszek.

---

### 2.11. Widoki błędów i globalne stany

- **Ścieżki widoków**:
  - 404 – brak dopasowania trasy lub brak zasobu.
  - 500 – awarie nieobsłużone (fallback UI).
- **Główny cel**: Czytelne informowanie o problemach z nawigacją lub serwerem.
- **Kluczowe informacje do wyświetlenia**:
  - 404:
    - „Nie znaleziono strony / fiszki”.
    - Link powrotny do `/study` lub `/cards`.
  - 500:
    - „Coś poszło nie tak. Spróbuj ponownie.” + przycisk reload.
- **Kluczowe komponenty widoku**:
  - Dedykowane strony błędów (np. w obrębie layoutu).
  - Globalne toasty dla błędów akcji.

---

## 3. Mapa podróży użytkownika

### 3.1. Główny flow: od rejestracji do pierwszych powtórek (AI)

1. **Wejście na stronę** → widok `/login` lub prosty landing z CTA „Zaloguj się” / „Załóż konto”.
2. **Rejestracja**:
   - Użytkownik przechodzi do `/register`.
   - Wypełnia `email`, `username`, `password`, `confirmPassword`.
   - Po sukcesie: zalogowanie i redirect do `/study`.
3. **Widok `/study`**:
   - UI wywołuje `/study/due-cards`.
   - Brak fiszek „due” → pusty stan:
     - „Brak fiszek do powtórki”.
     - CTA:
       - „Wygeneruj fiszki z tekstu” → `/ai/generate`.
       - „Dodaj fiszkę ręcznie” → `/cards/new`.
4. **Generator AI** (`/ai/generate`):
   - Użytkownik wkleja dłuższy tekst.
   - Naciska „Generuj fiszki” (POST `/ai/generate`).
   - Po sukcesie – lista wygenerowanych fiszek.
   - Użytkownik przegląda, decyduje się na zapis.
   - Klik „Zapisz wszystkie” (POST `/ai/cards/batch`).
   - Po sukcesie – toast „Zapisano X fiszek”, CTA do:
     - „Rozpocznij powtórki” → `/study`.
5. **Powtórki** (`/study`):
   - API zwraca karty due → UI pokazuje pierwszą fiszkę.
   - Użytkownik:
     - czyta `front`,
     - klika „Pokaż odpowiedź” → zobaczy `back`,
     - wybiera ocenę (0–5) → POST `/study/review`,
     - przechodzi do kolejnej fiszki, aż `cards` z `/study/due-cards` się wyczerpią.
   - Po zakończeniu – komunikat „Brak fiszek do powtórki” z CTA z powrotem do generacji/rysowania nowych fiszek.

### 3.2. Flow: poprawa fiszki wygenerowanej przez AI

1. Użytkownik widzi podczas nauki wątpliwą fiszkę.
2. Używa przycisku „Pokaż źródło” w widoku `/study` – weryfikuje błąd.
3. Po zakończonej sesji przechodzi do `/cards`.
4. Znajduje fiszkę (np. po dacie utworzenia, filtr `origin = ai`).
5. Wchodzi w `/cards/:id`.
6. Klik „Edytuj”, poprawia `front`, `back` lub `source_snippet`.
7. Zapisuje zmiany (PATCH `/cards/:id`).

### 3.3. Flow: manualne dodanie fiszki i późniejsza nauka

1. Użytkownik przechodzi na `/cards/new` z:
   - nawigacji,
   - pustego stanu `/study` lub `/cards`.
2. Wypełnia `front`, `back`, `source_snippet`, zapisuje.
3. Fiszka pojawia się na `/cards` i trafia do harmonogramu SM-2 (due_at).
4. Przy kolejnych powtórkach na `/study` ta fiszka pojawia się wśród kart due.

### 3.4. Flow: aktualizacja profilu

1. Użytkownik przechodzi do `/profile` z głównego menu.
2. Wprowadza nową nazwę użytkownika.
3. Zapisuje (PATCH `/profiles/me`).
4. Po sukcesie – aktualny username jest widoczny w topbarze.

---

## 4. Układ i struktura nawigacji

### 4.1. Hierarchia routingu

- **Publiczne**:
  - `/login`
  - `/register`
- **Zalogowane (pod głównym layoutem)**:
  - `/study` – widok powtórek (domyślny po zalogowaniu).
  - `/cards`
    - `/cards/new`
    - `/cards/:id`
    - `/cards/:id/edit` (opcjonalnie osobna trasa; można rozwiązać inline w `/cards/:id`).
  - `/ai/generate`
  - `/profile`
- **Fallbacki**:
  - `*` → strona 404 (w ramach publicznej / zalogowanej przestrzeni, zależnie od stanu auth).

### 4.2. Nawigacja główna

- **Desktop (>= md)**:
  - Sidebar po lewej:
    - Link „Powtórki” → `/study`
    - Link „Fiszki” → `/cards`
    - Link „Generator AI” → `/ai/generate`
    - Link „Dodaj ręcznie” → `/cards/new`
    - Link „Profil” → `/profile`
    - Przycisk „Wyloguj”
  - Topbar:
    - Logo / nazwa
    - Username (readonly)
- **Mobile (< md)**:
  - Topbar:
    - Logo / nazwa
    - Ikona menu (hamburger) otwierająca panel nawigacyjny z tymi samymi pozycjami.
  - Dolny pasek (opcjonalnie):
    - Ikony skrótów do /study, /cards, /ai/generate, /profile.

### 4.3. Nawigacja wtórna (w obrębie widoków)

- `/cards`:
  - Link/ikona „Dodaj fiszkę” (powtarza CTA do `/cards/new`).
- `/ai/generate`:
  - CTA po zapisaniu: „Przejdź do powtórek” → `/study` lub „Przejdź do listy fiszek” → `/cards`.
- Widoki błędów:
  - Link „Wróć do powtórek” → `/study`.

---

## 5. Kluczowe komponenty

Poniżej lista głównych komponentów UI używanych wielokrotnie:

1. **AppLayout**
   - Odpowiada za:
     - render topbara,
     - sidebar / mobile nav,
     - główny slot na treść.
   - Używany przez wszystkie trasy zalogowane.

2. **Topbar**
   - Zawiera:
     - logo / nazwę,
     - aktualnego użytkownika (username),
     - ewentualne szybkie akcje (wyloguj – np. w menu użytkownika).

3. **Sidebar / MobileNav**
   - Lista linków do głównych sekcji.
   - Odpowiednio responsywne zachowanie (drawer na mobile).

4. **AuthForm (Login / Register)**
   - Reużywalne pola i wzorzec obsługi błędów dla auth:
     - inputy,
     - obsługa błędów 400/401/409,
     - disabled stanu ładowania.

5. **FlashcardPreview / FlashcardRow**
   - Używane na liście `/cards`:
     - wyświetla front (skrót), origin, daty.
     - akcje: szczegóły, usuń.

6. **FlashcardDetail**
   - Komponent prezentujący pełną fiszkę (front/back/source_snippet + metadane).

7. **FlashcardForm**
   - Używany do:
     - tworzenia (`/cards/new`),
     - edycji (`/cards/:id`).
   - Posiada:
     - walidacje,
     - mapowanie błędów 400/422 na pola.

8. **StudyCard**
   - Kluczowy komponent w widoku `/study`:
     - stan „pytanie” vs „odpowiedź”.
     - przyciski oceny 0–5.
     - opcja „Pokaż źródło”.

9. **AiGeneratorPanel**
   - Zawiera:
     - textarea na tekst wejściowy,
     - przycisk „Generuj fiszki”,
     - obsługę błędów i state machine (początkowy / loading / wyniki).

10. **AiGeneratedCardsList**
    - Lista fiszek wygenerowanych przez AI:
      - wyświetlanie front/back/source_snippet.
      - przyciski „Zapisz wszystkie” / „Odrzuć wyniki”.

11. **EmptyState**
    - Używany w:
      - `/study` (brak kart due),
      - `/cards` (brak fiszek),
      - ew. innych kontekstach.
    - Parametry:
      - tytuł, opis, zestaw CTA.

12. **PaginationControls / LoadMoreButton**
    - Dwa warianty paginacji:
      - Desktop – bardziej klasyczny (poprzednia/następna strona).
      - Mobile – pojedynczy przycisk „Załaduj więcej”.

13. **ProfileForm**
    - Formularz zmiany username.
    - Obsługa 400 i 409.

14. **ConfirmDialog**
    - Reużywalny dialog potwierdzający (np. usunięcie fiszki).

15. **Toast / NotificationSystem**
    - Globalne toasty:
      - błędy sieciowe 5xx,
      - komunikaty o sukcesie (opcjonalnie),
      - specjalne traktowanie AI 503 („Spróbuj ponownie później”).

16. **ErrorBoundaryView**
    - Fallback dla nieobsłużonych błędów renderowania.
    - Informuje użytkownika, że coś poszło nie tak, i pozwala odświeżyć stronę.

---

Ta architektura UI:

- Pokrywa wszystkie historyjki użytkownika z PRD (auth, tworzenie manualne i AI, lista, podgląd, edycja/usuwanie, powtórki SM-2, profile).
- Jest ściśle zgodna z planem API (mapowanie widoków na `/auth/*`, `/profiles/me`, `/cards`, `/ai/*`, `/study/*`).
- Uwzględnia podstawowe kwestie UX (puste stany, przepływ end-to-end), bezpieczeństwa (izolacja kont, obsługa 401, brak pracy na `owner_id` po stronie UI) oraz minimalne wymagania dostępności na poziomie komponentów.