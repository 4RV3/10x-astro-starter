# ✅ Zaktualizowana Konfiguracja - Supabase w Dockerze

## 🎯 Co się zmieniło?

Zaktualizowałem konfigurację, aby **Supabase działała w Dockerze obok aplikacji na VPS**.

### Poprzednio (błędne założenie):
- Aplikacja w Docker
- Supabase zewnętrzna (cloud)
- `SUPABASE_URL=https://twoj-projekt.supabase.co`

### Teraz (poprawne):
- Aplikacja w Docker
- **Supabase w Docker** (pełny stack)
- `SUPABASE_URL=http://kong:8000` (wewnętrzna sieć Docker)

## 📋 Odpowiedź na Twoje pytanie

### Co wpisać w SUPABASE_URL?

**Krótka odpowiedź:**
```bash
SUPABASE_URL=http://kong:8000
```

**Dlaczego?**
- `kong` to nazwa serwisu w `docker-compose.production.yml`
- Docker automatycznie rozwiązuje nazwy serwisów w swojej sieci
- Aplikacja komunikuje się z Supabase **wewnętrznie** (szybciej, bezpieczniej)
- Port `8000` to wewnętrzny port Kong (API gateway Supabase)

### Pełny przewodnik konfiguracji

**📖 PRZECZYTAJ: `VPS-ENV-GUIDE.md`**

Ten dokument zawiera:
- Krok po kroku setup na VPS
- Jak wygenerować wszystkie wymagane wartości
- Gdzie wziąć klucze API
- FAQ i troubleshooting

## 📁 Nowe pliki w projekcie

```
├── VPS-ENV-GUIDE.md               ← ⭐ ZACZNIJ TUTAJ!
├── docker-compose.production.yml   ← Zaktualizowany (pełny Supabase stack)
├── deploy.sh                       ← Zaktualizowany
├── secrets/
│   ├── supabase.env.example       ← Nowy (szablon)
│   └── app.env.example            ← Nowy (szablon)
└── .github/workflows/ci-cd.yml    ← Zaktualizowany (kopiuje więcej plików)
```

## 🚀 Szybki start - VPS Setup

### 1. Na VPS utwórz pliki secrets

```bash
ssh erntoto@srv26.mikr.us -p 10129
sudo mkdir -p /opt/10xcards/secrets
sudo chown -R $USER:$USER /opt/10xcards
cd /opt/10xcards
```

### 2. Utwórz `secrets/supabase.env`

```bash
nano secrets/supabase.env
```

**Minimalna zawartość** (użyj swoich wartości!):
```env
POSTGRES_PASSWORD=twoje_bezpieczne_haslo
JWT_SECRET=twoj_jwt_secret_min_32_znaki_dlugosci
JWT_EXPIRY=3600
ANON_KEY=wygeneruj_lub_skopiuj_z_lokalnych_secrets
SERVICE_ROLE_KEY=wygeneruj_lub_skopiuj_z_lokalnych_secrets
SECRET_KEY_BASE=wygeneruj_losowy_string_64_znaki
```

**💡 Możesz użyć tych samych kluczy co lokalnie:**
```bash
# Na swoim komputerze:
cat secrets/supabase.env
# Skopiuj wartości
```

### 3. Utwórz `secrets/app.env`

```bash
nano secrets/app.env
```

**Zawartość:**
```env
SUPABASE_KEY=ten_sam_anon_key_co_w_supabase_env
SUPABASE_SERVICE_ROLE_KEY=ten_sam_service_role_key_co_w_supabase_env
OPENROUTER_API_KEY=twoj_klucz_z_openrouter_ai
```

### 4. Ustaw uprawnienia

```bash
chmod 600 secrets/*.env
```

### 5. Reszta setupu

Wykonaj pozostałe kroki z `SETUP-CHECKLIST.md`:
- Zaloguj się do GHCR
- Otwórz porty
- Push kodu

## 🔍 Weryfikacja

### Sprawdź czy pliki istnieją:
```bash
ssh erntoto@srv26.mikr.us -p 10129 "ls -la /opt/10xcards/secrets/"
```

Powinieneś zobaczyć:
```
-rw------- app.env
-rw------- supabase.env
```

### Sprawdź zawartość (bez wartości):
```bash
ssh erntoto@srv26.mikr.us -p 10129 "cat /opt/10xcards/secrets/supabase.env | grep -v '^#' | cut -d'=' -f1"
```

Powinno pokazać:
```
POSTGRES_PASSWORD
JWT_SECRET
JWT_EXPIRY
ANON_KEY
SERVICE_ROLE_KEY
SECRET_KEY_BASE
```

## 📚 Dokumentacja

**Kolejność czytania:**

1. **VPS-ENV-GUIDE.md** ← Zacznij tutaj! Szczegóły konfiguracji ENV
2. **SETUP-CHECKLIST.md** ← Checklist krok po kroku
3. **IMPLEMENTATION-SUMMARY.md** ← Co zostało zrobione
4. **CI-CD-SETUP.md** ← Szczegóły CI/CD
5. **TESTING.md** ← Jak pisać testy

## ❓ Częste pytania

**Q: Czy muszę mieć Supabase cloud?**
Nie! Supabase działa w pełni w Dockerze na Twoim VPS.

**Q: Jak dostać się do Supabase z zewnątrz?**
Port 54321 jest wystawiony. Możesz otworzyć w firewall: `sudo ufw allow 54321/tcp`

**Q: Jak dostać się do PostgreSQL?**
```bash
ssh erntoto@srv26.mikr.us -p 10129
docker exec -it 10xcards-db-1 psql -U postgres
```

**Q: Czy mogę użyć tych samych secrets co lokalnie?**
Tak! Dla testów możesz skopiować `secrets/supabase.env` i `secrets/app.env` z repo. Dla produkcji lepiej wygenerować nowe.

**Q: Gdzie są dane bazy?**
W Docker volume: `supabase_db_data`. Backup: `docker run --rm -v 10xcards_supabase_db_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .`

## 🆘 Potrzebujesz pomocy?

1. Sprawdź `VPS-ENV-GUIDE.md` - sekcja Troubleshooting
2. Sprawdź logi: `docker compose -f docker-compose.production.yml logs -f`
3. Sprawdź czy wszystkie kontenery działają: `docker compose -f docker-compose.production.yml ps`

## ✨ Gotowe do deploymentu!

Po skonfigurowaniu secrets na VPS:

```bash
git add .
git commit -m "Update production config with Supabase in Docker"
git push origin master
```

Pipeline automatycznie zdeployuje wszystko! 🚀
