# Konfiguracja Środowiska Produkcyjnego - VPS Guide

## 📋 Przegląd

Aplikacja na VPS działa z **pełnym stackiem Supabase w Dockerze**. Wszystkie serwisy (aplikacja + Supabase) są w jednej sieci Docker.

## 🔑 Co wpisać w plikach ENV?

### ✅ Odpowiedź na Twoje pytanie: SUPABASE_URL

**Na produkcji (VPS) wpisz:**
```bash
SUPABASE_URL=http://kong:8000
```

**Dlaczego `http://kong:8000`?**
- Kong jest API gateway Supabase w Docker
- Aplikacja komunikuje się z Supabase **wewnątrz sieci Docker**
- `kong:8000` to nazwa serwisu Docker (Docker DNS automatycznie rozwiązuje)
- Port 8000 to port wewnętrzny Kong (nie mylić z 54321 który jest zewnętrzny)

### 📁 Struktura plików na VPS: `/opt/10xcards/`

```
/opt/10xcards/
├── secrets/
│   ├── supabase.env         ← Zmienne Supabase
│   └── app.env              ← Zmienne aplikacji
├── docker/                  ← Konfiguracja Supabase (skopiowane z repo)
├── supabase/               ← Migracje bazy danych (skopiowane z repo)
├── docker-compose.production.yml
└── deploy.sh
```

## 🛠️ Krok po kroku: Konfiguracja na VPS

### 1. Połącz się z VPS
```bash
ssh user@hostname -p port
```

### 2. Utwórz strukturę katalogów
```bash
sudo mkdir -p /opt/10xcards/secrets
sudo chown -R $USER:$USER /opt/10xcards
cd /opt/10xcards
```

### 3. Utwórz `secrets/supabase.env`

```bash
nano /opt/10xcards/secrets/supabase.env
```

**Treść pliku:**
```bash
# Database password - wygeneruj bezpieczny:
POSTGRES_PASSWORD=wpisz_tu_swoje_haslo_do_postgres

# JWT Secret - musi mieć min 32 znaki:
JWT_SECRET=wpisz_tu_swoj_jwt_secret_min_32_znaki

# JWT expiry (w sekundach)
JWT_EXPIRY=3600

# ANON_KEY i SERVICE_ROLE_KEY
# Użyj tych samych kluczy co lokalnie lub wygeneruj nowe:
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Secret key base dla Realtime
SECRET_KEY_BASE=wygeneruj_losowy_string_64_znaki
```

**💡 Jak wygenerować bezpieczne wartości?**
```bash
# Password dla PostgreSQL
openssl rand -base64 32

# JWT_SECRET
openssl rand -base64 32

# SECRET_KEY_BASE
openssl rand -base64 48
```

**💡 Skąd wziąć ANON_KEY i SERVICE_ROLE_KEY?**

Opcja A: **Użyj tych samych co lokalnie** (z `secrets/supabase.env` w repo)
```bash
# Na swoim komputerze:
cat secrets/supabase.env | grep KEY
# Skopiuj wartości ANON_KEY i SERVICE_ROLE_KEY
```

Opcja B: **Wygeneruj nowe** (polecam dla produkcji):
1. Idź do: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
2. Użyj swojego `JWT_SECRET` do wygenerowania kluczy
3. Lub użyj https://jwt.io/ z Twoim JWT_SECRET

### 4. Utwórz `secrets/app.env`

```bash
nano /opt/10xcards/secrets/app.env
```

**Treść pliku:**
```bash
# Te same wartości co w supabase.env:
SUPABASE_KEY=twoj_anon_key_z_powyzszego
SUPABASE_SERVICE_ROLE_KEY=twoj_service_role_key_z_powyzszego

# OpenRouter API Key (dla AI)
OPENROUTER_API_KEY=sk-or-v1-twoj_klucz_openrouter
```

**💡 Skąd wziąć OPENROUTER_API_KEY?**
1. Idź do: https://openrouter.ai/
2. Zaloguj się
3. Settings → Keys → Create Key

### 5. Ustaw uprawnienia
```bash
chmod 600 /opt/10xcards/secrets/*.env
```

### 6. Zaloguj się do GitHub Container Registry
```bash
# Wygeneruj token: https://github.com/settings/tokens
# Permissions: read:packages

echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u 4RV3 --password-stdin
```

### 7. Otwórz porty
```bash
# Port aplikacji (wymagany)
sudo ufw allow 8080/tcp

# Opcjonalnie - jeśli chcesz bezpośredni dostęp do Supabase z zewnątrz:
# sudo ufw allow 54321/tcp   # Supabase API
# sudo ufw allow 54322/tcp   # PostgreSQL

# Sprawdź status
sudo ufw status
```

## ✅ Weryfikacja konfiguracji

### Sprawdź pliki:
```bash
ls -la /opt/10xcards/secrets/
# Powinno być:
# -rw------- app.env
# -rw------- supabase.env
```

### Sprawdź zawartość (bez pokazywania wartości):
```bash
echo "=== supabase.env ==="
cat /opt/10xcards/secrets/supabase.env | grep -v "^#" | grep "=" | cut -d'=' -f1
echo "=== app.env ==="
cat /opt/10xcards/secrets/app.env | grep -v "^#" | grep "=" | cut -d'=' -f1
```

Powinieneś zobaczyć nazwy zmiennych (bez wartości):
```
=== supabase.env ===
POSTGRES_PASSWORD
JWT_SECRET
JWT_EXPIRY
ANON_KEY
SERVICE_ROLE_KEY
SECRET_KEY_BASE

=== app.env ===
SUPABASE_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
```

## 🚀 Pierwszy deployment

Po skonfigurowaniu plików env, wypushuj kod:
```bash
# Na swoim komputerze
git push origin master
```

GitHub Actions automatycznie:
1. Zbuduje aplikację
2. Uruchomi testy
3. Zbuduje Docker image
4. Skopiuje pliki na VPS
5. Uruchomi `deploy.sh`

## 📊 Sprawdzanie aplikacji

### Na VPS:
```bash
ssh user@hostname -p port
cd /opt/10xcards

# Status wszystkich kontenerów
docker compose -f docker-compose.production.yml ps

# Logi aplikacji
docker compose -f docker-compose.production.yml logs -f app

# Logi wszystkich serwisów
docker compose -f docker-compose.production.yml logs -f

# Health check
curl http://localhost:8080/
```

### Z zewnątrz:
```bash
# Aplikacja
curl http://example.com:8080/

# Supabase API (jeśli port otwarty)
curl http://example.com:54321/
```

## 🔧 Przydatne komendy

### Restart aplikacji:
```bash
docker compose -f docker-compose.production.yml restart app
```

### Restart wszystkiego:
```bash
docker compose -f docker-compose.production.yml restart
```

### Przebuduj i uruchom:
```bash
cd /opt/10xcards
./deploy.sh
```

### Sprawdź użycie zasobów:
```bash
docker stats
```

### Dostęp do bazy danych:
```bash
# Pobierz hasło
grep POSTGRES_PASSWORD /opt/10xcards/secrets/supabase.env

# Połącz się
docker exec -it 10xcards-db-1 psql -U postgres
```

## ❓ FAQ

**Q: Czy mogę użyć zewnętrznej Supabase zamiast Docker?**  
A: Tak, zmień w `docker-compose.production.yml`:
```yaml
environment:
  SUPABASE_URL: "https://twoj-projekt.supabase.co"
```
I usuń wszystkie serwisy Supabase z compose.

**Q: Jak zmigrować dane z lokalnej Supabase na VPS?**  
A: Użyj `pg_dump` i `pg_restore` lub skopiuj volume.

**Q: Jakie zasoby potrzebuje VPS?**  
A: Minimum:
- 2 GB RAM
- 20 GB dysku
- 1 vCPU

**Q: Jak zaktualizować Supabase?**  
A: Zmień wersje obrazów w `docker-compose.production.yml` i uruchom `./deploy.sh`

## 🆘 Troubleshooting

### Problem: Kontener aplikacji nie startuje
```bash
# Sprawdź logi
docker compose -f docker-compose.production.yml logs app

# Sprawdź czy secrets istnieją
ls -la /opt/10xcards/secrets/
```

### Problem: "Connection refused" do Supabase
```bash
# Sprawdź czy Kong działa
docker compose -f docker-compose.production.yml ps kong

# Sprawdź logi Kong
docker compose -f docker-compose.production.yml logs kong
```

### Problem: Migracje nie działają
```bash
# Sprawdź logi migracji
docker compose -f docker-compose.production.yml logs db-migrate

# Ręcznie uruchom migracje
docker compose -f docker-compose.production.yml up db-migrate
```

## 📚 Zobacz także

- `CI-CD-SETUP.md` - Pełna dokumentacja CI/CD
- `SETUP-CHECKLIST.md` - Checklist krok po kroku
- `IMPLEMENTATION-SUMMARY.md` - Co zostało zaimplementowane
