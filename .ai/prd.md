# Dokument wymagań produktu (PRD) - FlashAI (MVP)
## 1. Przegląd produktu
1.1 Cel produktu  
Webowa aplikacja do tworzenia i nauki fiszek metodą spaced repetition. Kluczowa wartość MVP: szybkie generowanie fiszek przez AI z wklejonego tekstu oraz natychmiastowa możliwość powtórek z użyciem prostego algorytmu SM-2.

1.2 Zakres MVP (w skrócie)  
- Generowanie fiszek AI z wejścia typu kopiuj-wklej (bez obróbki i bez limitów na ten moment)
- Manualne tworzenie fiszek
- Przeglądanie, edycja, usuwanie fiszek
- Prosty system kont oparty o Supabase Auth + profil użytkownika (username w osobnej tabeli profilu)
- Nauka fiszek w oparciu o algorytm SM-2
- Format fiszek: tylko Basic (przód/tył), tylko tekst
- Pole bezpieczeństwa jakości: source snippet przypięty do każdej fiszki + podstawowe podejście na wypadek halucynacji

1.3 Użytkownicy docelowi  
Wszystkie osoby uczące się (bez zawężenia segmentów/person na MVP).

1.4 Założenia i decyzje produktowe  
- Akceptacja fiszki AI: fiszka jest uznana za zaakceptowaną, gdy użytkownik ją zapisze (bez dodatkowych ocen/jakości).
- UX po generacji: preferowana masowa akceptacja fiszek; selekcja/edycja per karta nie jest wymogiem.
- Brak organizacji fiszek: bez talii, tagów, wyszukiwarki w MVP.
- Brak harmonogramu/zasobów/budżetu na tym etapie (do uzupełnienia później).

1.5 Platforma i środowisko  
- Tylko aplikacja web (desktop/mobile web dopuszczalne, brak natywnych aplikacji mobilnych).
- Przechowywanie danych per konto użytkownika.

## 2. Problem użytkownika
2.1 Problem główny  
Manualne tworzenie wysokiej jakości fiszek jest czasochłonne, co zniechęca do korzystania z efektywnej metody nauki spaced repetition.

2.2 Kontekst i skutki  
- Użytkownik posiada materiał (notatki, artykuły, podręcznik w formie tekstu) i chce szybko zamienić go w fiszki.
- Manualne tworzenie powoduje barierę wejścia, spadek motywacji i odkładanie nauki.
- Brak prostego przepływu: od treści do fiszek do powtórek w jednym miejscu.

2.3 Potrzeby użytkownika (MVP)  
- Szybko wygenerować sensowne fiszki na podstawie wklejonego tekstu.
- Mieć możliwość ręcznego dodania/naprawienia fiszek.
- Łatwo przejrzeć i poprawić błędy w fiszkach.
- Bezpiecznie przechowywać fiszki w ramach konta.
- Od razu uczyć się wg sprawdzonego, prostego algorytmu powtórek.
- Mieć kontekst źródłowy przy fiszce, aby ograniczyć ryzyko halucynacji i ułatwić weryfikację.

## 3. Wymagania funkcjonalne
3.1 Zarządzanie kontem użytkownika (Auth)  
- Rejestracja i logowanie realizowane przez Supabase Auth (źródło prawdy dla tożsamości).
- `username` przechowywany w osobnej tabeli profilu powiązanej 1:1 z `auth.users`.
- Unikalność `username` wymuszona na znormalizowanej wartości (np. `citext` lub unikalny indeks na `lower(username)`).
- Sesja użytkownika utrzymywana między odświeżeniami (mechanizm Supabase Auth).
- Ograniczenie dostępu: użytkownik widzi i modyfikuje tylko swoje fiszki i swoje postępy powtórek (RLS oparte o `auth.uid()`).
- NOTE: przechowywanie haseł jako hash jest odpowiedzialnością Supabase Auth (nie tworzymy własnej tabeli z hashami haseł).

3.2 Model danych fiszki (MVP)  
- Typ: Basic (front/back), tylko tekst.
- Pola minimalne:
  - front (tekst)
  - back (tekst)
  - source snippet (tekst, fragment źródła) — wymagane i niepuste na poziomie DB
  - metadata powtórek SM-2 per fiszka: minimum `ease_factor`, `interval_days`, `repetitions`, `due_at`, `last_reviewed_at`
  - timestamps (createdAt, updatedAt)
- Powiązanie fiszki z użytkownikiem (ownerId = `auth.uid()`).

3.3 Tworzenie fiszek manualnie  
- Formularz dodania pojedynczej fiszki z polami: front, back, source snippet.
- Walidacje:
  - front i back wymagane
  - source snippet wymagane do zapisu (jeśli nie jest dostępne, użytkownik może wpisać np. “Brak”; DB nie akceptuje pustego stringa/whitespace)
  - ograniczenia techniczne długości pól po stronie backendu (DB CHECK), bez limitów produktowych dla wejścia AI.

3.4 Generowanie fiszek przez AI z wklejonego tekstu  
- Wejście: pole tekstowe kopiuj-wklej (bez obróbki, bez limitów produktowych na ten moment).
- Wynik: lista propozycji fiszek Basic (front/back) wraz z source snippet dla każdej fiszki.
- UX: masowa akceptacja:
  - użytkownik może zapisać wszystkie wygenerowane fiszki jednym działaniem
  - opcjonalnie: może odrzucić całą paczkę i wygenerować ponownie
- Definicja akceptacji: fiszki zapisane do konta użytkownika.
- Niezawodny zapis wygenerowanych fiszek: zapis “Zapisz wszystkie” powinien być transakcyjny (all-or-nothing).

3.5 Przeglądanie i zarządzanie fiszkami (CRUD)  
- Lista fiszek użytkownika (bez organizacji, bez tagów, bez talii).
- Podgląd pojedynczej fiszki (front/back/source snippet).
- Edycja fiszki (front/back/source snippet).
- Usuwanie fiszki (potwierdzenie).
- Usuwanie fiszek: hard delete w MVP (z potwierdzeniem w UI).
- Wydajność listy: paginacja/lazy loading + indeksy (min. ownerId + due_at dla zapytań “due”).
- Brak wyszukiwarki jako wymóg MVP, ale lista musi być używalna przy rosnącej liczbie fiszek (np. paginacja lub lazy loading).

3.6 Powtórki (Study) z użyciem SM-2  
- Ekran powtórek:
  - pokazuje fiszki “due” (do powtórki na teraz)
  - prezentacja: najpierw front, potem ujawnienie back
  - użytkownik ocenia odpowiedź skalą zgodną z SM-2 (np. 0–5) lub uproszczonym mapowaniem na SM-2 (wymaganie: zgodność wyniku z SM-2)
- Aktualizacja parametrów SM-2 po ocenie.
- Obsługa braku fiszek do powtórki: komunikat “Brak fiszek do powtórki”.

3.7 Podstawowe podejście na wypadek halucynacji (jakość/bezpieczeństwo)  
- Każda fiszka ma pole source snippet.
- Na ekranie podglądu/edycji/powtórki dostęp do source snippet:
  - w powtórkach source snippet może być widoczny po rozwinięciu (aby nie rozpraszać).
- W AI generate: model ma generować fiszki oparte na podanym tekście i dołączać source snippet wycięty z wejścia.
- Ostrzeżenie UI (copy): “Zweryfikuj fiszki z materiałem źródłowym. AI może popełniać błędy.”
- Minimalna walidacja spójności: source snippet nie może być puste przy zapisie fiszek AI.

3.8 Wymagania niefunkcjonalne (MVP)  
- Dostępność: podstawowa dostępność klawiaturowa dla kluczowych akcji (logowanie, generacja, zapis, powtórki).
- Bezpieczeństwo:
  - hasła przechowywane jako hash (np. bcrypt/argon2)
  - ochrona endpointów przed dostępem bez autoryzacji
  - prywatność danych przez RLS (private-by-default; anon bez dostępu do tabel domenowych; polityki oparte o `auth.uid()`)
- Niezawodność:
  - niezawodny zapis wygenerowanych fiszek (transakcyjność lub mechanizm minimalizujący częściowy zapis)
- Prywatność: dane fiszek prywatne per konto.

## 4. Granice produktu
4.1 Poza zakresem MVP  
- Własny zaawansowany algorytm powtórek (jak SuperMemo, Anki) poza prostym SM-2.
- Import wielu formatów (PDF, DOCX, itp.) – tylko kopiuj-wklej tekstu.
- Współdzielenie zestawów fiszek między użytkownikami.
- Integracje z innymi platformami edukacyjnymi.
- Natywne aplikacje mobilne.
- Organizacja: brak talii, tagów, folderów.
- Wyszukiwarka fiszek.
- Zaawansowana moderacja jakości (ranking, feedback per karta, workflow akceptacji per karta jako obowiązek).

4.2 Świadome kompromisy MVP  
- AI może generować błędne fiszki; mitigacja: source snippet + ostrzeżenie + łatwa edycja/usuwanie.
- Brak segmentacji użytkowników i personalizacji UI.

## 5. Historyjki użytkowników

5.1 Auth i bezpieczeństwo dostępu
- ID: US-001  
  Tytuł: Rejestracja konta  
  Opis: Jako użytkownik chcę założyć konto używając nazwy użytkownika i hasła, aby zapisywać fiszki i postępy.  
  Kryteria akceptacji:
  - Formularz rejestracji zawiera pola: nazwa użytkownika, hasło, potwierdzenie hasła.
  - Walidacja: nazwa użytkownika wymagana; hasło wymagane; hasła muszą być zgodne.
  - Po udanej rejestracji użytkownik jest zalogowany lub przekierowany do logowania z jasnym komunikatem sukcesu.
  - Próba rejestracji z zajętą nazwą użytkownika kończy się komunikatem błędu.

- ID: US-002  
  Tytuł: Logowanie  
  Opis: Jako użytkownik chcę zalogować się nazwą użytkownika i hasłem, aby uzyskać dostęp do swoich fiszek.  
  Kryteria akceptacji:
  - Formularz logowania zawiera pola: nazwa użytkownika, hasło.
  - Poprawne dane logują użytkownika i zapewniają dostęp do widoków aplikacji.
  - Błędne dane nie logują użytkownika i pokazują komunikat błędu bez ujawniania, czy konto istnieje.

- ID: US-003  
  Tytuł: Wylogowanie  
  Opis: Jako użytkownik chcę się wylogować, aby zakończyć sesję na współdzielonym urządzeniu.  
  Kryteria akceptacji:
  - Widoczny jest przycisk wylogowania dla zalogowanego użytkownika.
  - Po wylogowaniu zasoby wymagające autoryzacji nie są dostępne bez ponownego logowania.

- ID: US-004  
  Tytuł: Izolacja danych między użytkownikami (autoryzacja)  
  Opis: Jako użytkownik chcę mieć pewność, że inni użytkownicy nie mają dostępu do moich fiszek i postępów.  
  Kryteria akceptacji:
  - Zalogowany użytkownik widzi wyłącznie fiszki i dane powtórek przypisane do jego konta.
  - Próba dostępu do zasobu innego użytkownika (np. przez manipulację ID) skutkuje odmową (np. 403/404) i nie ujawnia danych.

- ID: US-005  
  Tytuł: Obsługa wygaśniętej sesji  
  Opis: Jako użytkownik chcę dostać jasną informację i możliwość ponownego logowania, gdy moja sesja wygaśnie.  
  Kryteria akceptacji:
  - Gdy sesja wygaśnie, próba wejścia na chroniony widok przekierowuje do logowania.
  - Po zalogowaniu użytkownik wraca do głównego widoku aplikacji.

5.2 Manualne tworzenie fiszek
- ID: US-010  
  Tytuł: Dodanie manualnej fiszki  
  Opis: Jako użytkownik chcę dodać fiszkę ręcznie (front/back), aby utrwalić wybrany materiał.  
  Kryteria akceptacji:
  - Użytkownik może otworzyć formularz dodawania fiszki.
  - Front i back są wymagane do zapisu.
  - Source snippet jest wymagany do zapisu (może być minimalnym kontekstem).
  - Po zapisie fiszka pojawia się na liście fiszek użytkownika.

- ID: US-011  
  Tytuł: Walidacja błędów przy tworzeniu fiszki  
  Opis: Jako użytkownik chcę otrzymać czytelne komunikaty walidacyjne, aby poprawnie zapisać fiszkę.  
  Kryteria akceptacji:
  - Próba zapisu bez front kończy się komunikatem o brakującym polu.
  - Próba zapisu bez back kończy się komunikatem o brakującym polu.
  - Próba zapisu bez source snippet kończy się komunikatem o brakującym polu.

5.3 Generowanie fiszek przez AI
- ID: US-020  
  Tytuł: Wklejenie tekstu do generatora AI  
  Opis: Jako użytkownik chcę wkleić tekst bez dodatkowej obróbki, aby wygenerować fiszki.  
  Kryteria akceptacji:
  - Widok generacji zawiera duże pole tekstowe na wklejany materiał.
  - Użytkownik może wkleić dowolny tekst (produktowo bez limitów; technicznie aplikacja może obsłużyć duże wejścia bez crashu).
  - Przycisk “Generuj” jest dostępny po wprowadzeniu tekstu.

- ID: US-021  
  Tytuł: Generacja propozycji fiszek AI  
  Opis: Jako użytkownik chcę otrzymać propozycje fiszek Basic z wklejonego tekstu, aby oszczędzić czas.  
  Kryteria akceptacji:
  - Po kliknięciu “Generuj” użytkownik otrzymuje listę wygenerowanych fiszek.
  - Każda propozycja zawiera: front, back oraz source snippet.
  - Jeśli AI nie może wygenerować fiszek, użytkownik dostaje komunikat i możliwość ponowienia próby.

- ID: US-022  
  Tytuł: Masowa akceptacja wygenerowanych fiszek  
  Opis: Jako użytkownik chcę zapisać wszystkie wygenerowane fiszki jednym działaniem, aby szybko przejść do nauki.  
  Kryteria akceptacji:
  - W widoku wyników generacji dostępna jest akcja “Zapisz wszystkie”.
  - Po użyciu “Zapisz wszystkie” fiszki są zapisane na koncie użytkownika.
  - Zapisane fiszki są widoczne na liście fiszek.
  - Akceptacja jest liczona jako zapis (bez dodatkowych kroków).

- ID: US-023  
  Tytuł: Odrzucenie wyników i ponowna generacja  
  Opis: Jako użytkownik chcę móc odrzucić całą paczkę wygenerowanych fiszek i spróbować ponownie, gdy wynik jest słaby.  
  Kryteria akceptacji:
  - Dostępna jest akcja “Odrzuć” lub “Wyczyść wyniki”.
  - Po odrzuceniu propozycje nie są zapisane w systemie.
  - Użytkownik może ponownie użyć “Generuj” dla tego samego lub nowego tekstu.

- ID: US-024  
  Tytuł: Bezpieczne powiązanie fiszek AI ze źródłem (source snippet)  
  Opis: Jako użytkownik chcę widzieć fragment źródła przy każdej fiszce AI, aby móc zweryfikować poprawność.  
  Kryteria akceptacji:
  - Każda zapisana fiszka AI zawiera niepusty source snippet.
  - Source snippet jest widoczny w podglądzie fiszki i w edycji.
  - W widoku generacji użytkownik widzi source snippet w propozycjach lub ma do niego dostęp (np. rozwijany szczegół).

5.4 Lista i podgląd fiszek
- ID: US-030  
  Tytuł: Lista wszystkich fiszek użytkownika  
  Opis: Jako użytkownik chcę przeglądać listę moich fiszek, aby zarządzać nimi.  
  Kryteria akceptacji:
  - Widok listy pokazuje fiszki należące do zalogowanego użytkownika.
  - Lista jest dostępna bez konieczności posiadania talii/tagów.
  - Przy większej liczbie fiszek lista pozostaje używalna (np. paginacja lub ładowanie partiami).

- ID: US-031  
  Tytuł: Podgląd pojedynczej fiszki  
  Opis: Jako użytkownik chcę otworzyć fiszkę i zobaczyć jej front, back i source snippet, aby zweryfikować treść.  
  Kryteria akceptacji:
  - Po kliknięciu fiszki z listy otwiera się widok szczegółów.
  - Widok pokazuje front, back, source snippet.

5.5 Edycja i usuwanie fiszek
- ID: US-040  
  Tytuł: Edycja fiszki  
  Opis: Jako użytkownik chcę edytować fiszkę, aby poprawić błędy z AI lub moje własne.  
  Kryteria akceptacji:
  - Użytkownik może edytować front, back i source snippet.
  - Walidacja blokuje zapis, gdy front/back/source snippet są puste.
  - Po zapisie zmiany są widoczne w podglądzie i na liście.

- ID: US-041  
  Tytuł: Usunięcie fiszki  
  Opis: Jako użytkownik chcę usunąć fiszkę, aby pozbyć się niepotrzebnych lub błędnych kart.  
  Kryteria akceptacji:
  - Użytkownik może zainicjować usunięcie fiszki z widoku listy lub szczegółów.
  - System wymaga potwierdzenia usunięcia.
  - Po potwierdzeniu fiszka znika z listy i nie jest dostępna do powtórek.

- ID: US-042  
  Tytuł: Obsługa błędów zapisu/edycji/usuwania  
  Opis: Jako użytkownik chcę dostać komunikat, jeśli operacja na fiszce się nie powiedzie, aby nie zgubić pracy.  
  Kryteria akceptacji:
  - W przypadku błędu sieci lub serwera użytkownik widzi czytelny komunikat.
  - Aplikacja nie pokazuje operacji jako zakończonej sukcesem, jeśli zapis nie nastąpił.

5.6 Powtórki (SM-2)
- ID: US-050  
  Tytuł: Rozpoczęcie sesji powtórek  
  Opis: Jako użytkownik chcę rozpocząć powtórki, aby uczyć się fiszek w odpowiednich odstępach czasu.  
  Kryteria akceptacji:
  - Widok “Powtórki” jest dostępny dla zalogowanego użytkownika.
  - Jeśli są fiszki due, system prezentuje pierwszą fiszkę.

- ID: US-051  
  Tytuł: Odsłonięcie odpowiedzi (back)  
  Opis: Jako użytkownik chcę zobaczyć odpowiedź dopiero po próbie przypomnienia, aby nauka była skuteczna.  
  Kryteria akceptacji:
  - Na początku widoczny jest front.
  - Użytkownik wykonuje akcję “Pokaż odpowiedź”, po której widoczny jest back.

- ID: US-052  
  Tytuł: Ocena odpowiedzi i aktualizacja SM-2  
  Opis: Jako użytkownik chcę ocenić, jak dobrze znałem odpowiedź, aby algorytm zaplanował kolejną powtórkę.  
  Kryteria akceptacji:
  - Po odsłonięciu odpowiedzi użytkownik może wybrać ocenę zgodną z SM-2.
  - Po ocenie parametry SM-2 fiszki są aktualizowane, a due date jest przeliczany.
  - Następna fiszka due jest prezentowana automatycznie lub po akcji “Dalej”.

- ID: US-053  
  Tytuł: Brak fiszek do powtórki  
  Opis: Jako użytkownik chcę dostać informację, gdy nie mam nic do powtórki, aby wiedzieć, że jestem na bieżąco.  
  Kryteria akceptacji:
  - Gdy brak fiszek due, widok powtórek pokazuje komunikat “Brak fiszek do powtórki”.
  - Użytkownik ma możliwość przejścia do listy fiszek lub generacji AI.

- ID: US-054  
  Tytuł: Dostęp do source snippet podczas powtórki  
  Opis: Jako użytkownik chcę móc sprawdzić source snippet w trakcie powtórki, gdy mam wątpliwości co do poprawności fiszki.  
  Kryteria akceptacji:
  - W widoku powtórki dostępna jest opcja pokazania source snippet (np. “Pokaż źródło”).
  - Po użyciu opcji wyświetlany jest source snippet przypisany do fiszki.

5.7 Scenariusze skrajne i alternatywne (end-to-end użyteczność)
- ID: US-060  
  Tytuł: Pierwsze uruchomienie i “puste konto”  
  Opis: Jako nowy użytkownik chcę zobaczyć jasne wskazówki, co zrobić, gdy nie mam żadnych fiszek, aby szybko zacząć.  
  Kryteria akceptacji:
  - Po zalogowaniu i braku fiszek użytkownik widzi stan pusty z CTA do: “Generuj z AI” oraz “Dodaj manualnie”.
  - CTA prowadzą do odpowiednich widoków.

- ID: US-061  
  Tytuł: Anulowanie generacji AI w trakcie (alternatywa)  
  Opis: Jako użytkownik chcę móc przerwać generowanie, jeśli wkleiłem zły tekst lub zmieniłem zdanie.  
  Kryteria akceptacji:
  - Podczas generowania dostępna jest akcja “Anuluj”.
  - Po anulowaniu aplikacja wraca do stanu gotowości bez zapisu fiszek.

- ID: US-062  
  Tytuł: Odporność na bardzo długi tekst wejściowy (skrajny)  
  Opis: Jako użytkownik chcę wkleić bardzo długi materiał bez awarii aplikacji.  
  Kryteria akceptacji:
  - Aplikacja nie zawiesza się ani nie traci sesji podczas wklejenia dużego tekstu.
  - Jeśli system nie może przetworzyć wejścia (techniczny limit), użytkownik dostaje komunikat i sugestię skrócenia tekstu, bez utraty wklejonego materiału.

- ID: US-063  
  Tytuł: Ochrona przed utratą wygenerowanych wyników (skrajny)  
  Opis: Jako użytkownik chcę uniknąć utraty wygenerowanej paczki fiszek przed zapisem, aby nie powtarzać generacji.  
  Kryteria akceptacji:
  - Jeżeli użytkownik próbuje opuścić widok z wygenerowanymi, niezapisanymi fiszkami, aplikacja ostrzega o niezapisanych zmianach.
  - Użytkownik może pozostać na stronie lub świadomie ją opuścić.

5.8 Lista kontrolna (weryfikacja PRD)
- Testowalność historyjek:
  - Wszystkie US mają kryteria akceptacji sformułowane jako obserwowalne zachowania/warunki.
- Jasność kryteriów:
  - Dla kluczowych przepływów (auth, generacja, zapis, CRUD, powtórki) kryteria są binarne.
- Wystarczalność do zbudowania MVP:
  - PRD obejmuje end-to-end: konto -> tworzenie AI/manual -> zapis -> lista -> edycja/usuwanie -> powtórki SM-2.
- Auth i autoryzacja:
  - Uwzględnione w US-001..US-005, w tym izolacja danych.

## 6. Metryki sukcesu
6.1 Metryki produktowe (kryteria sukcesu MVP)  
- Akceptacja jakości AI:
  - 75% fiszek wygenerowanych przez AI jest akceptowane przez użytkownika.
  - Definicja akceptacji: fiszka jest zaakceptowana, gdy zostanie zapisana.
  - Sposób pomiaru: (liczba zapisanych fiszek AI) / (liczba wszystkich wygenerowanych fiszek AI) w danym okresie.

- Udział AI w tworzeniu:
  - Użytkownicy tworzą 75% fiszek z wykorzystaniem AI.
  - Sposób pomiaru: (liczba fiszek zapisanych z przepływu AI) / (liczba wszystkich nowych fiszek: AI + manual) w danym okresie.

6.2 Metryki diagnostyczne (pomocnicze)
- Konwersja generacji do zapisu:
  - Odsetek sesji generacji zakończonych “Zapisz wszystkie”.
- Retencja nauki:
  - Odsetek użytkowników wykonujących powtórki w 1., 7. i 14. dniu od rejestracji (metryka pomocnicza, nie jako kryterium sukcesu).
- Stabilność:
  - Odsetek nieudanych zapisów fiszek (AI/manual) i błędów w powtórkach.

6.3 Instrumentacja minimalna (wymóg do pomiaru metryk)
- Logowanie zdarzeń:
  - AI_generate_requested, AI_generate_succeeded/failed
  - AI_cards_generated_count
  - AI_cards_saved_count
  - Manual_card_created
  - Study_session_started, Card_reviewed (z oceną), No_cards_due_shown
- Rozróżnienie pochodzenia fiszki: AI vs manual.