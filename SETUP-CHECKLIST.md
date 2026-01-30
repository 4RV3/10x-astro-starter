# 🚀 Quick Setup Checklist

Użyj tego checklistu, aby skonfigurować CI/CD i deployment na VPS.

## ☑️ Etap 1: GitHub Secrets (5 min)

### Krok 1.1: Wygeneruj klucz SSH
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key
```
- [ ] Klucz wygenerowany

### Krok 1.2: Dodaj klucz na VPS
```bash
ssh-copy-id -i ~/.ssh/github_actions_key.pub -p port user@hostname
```
- [ ] Klucz skopiowany na VPS

### Krok 1.3: Dodaj GitHub Secrets
Idź do: https://github.com/4RV3/10x-astro-starter/settings/secrets/actions

Dodaj następujące secrets:

1. **VPS_SSH_KEY**
   ```bash
   cat ~/.ssh/github_actions_key
   ```
   Skopiuj całą zawartość (BEGIN i END włącznie)
   - [ ] Secret `VPS_SSH_KEY` dodany

2. **VPS_HOST**  
   Wartość: `hostname`
   - [ ] Secret `VPS_HOST` dodany

3. **VPS_USER**  
   Wartość: `user`
   - [ ] Secret `VPS_USER` dodany

4. **VPS_SSH_PORT**  
   Wartość: `port`
   - [ ] Secret `VPS_SSH_PORT` dodany

## ☑️ Etap 2: Setup VPS (10 min)

### Krok 2.1: Połącz się z VPS
```bash
ssh user@hostname -p port
```
- [ ] Połączono z VPS

### Krok 2.2: Utwórz katalog
```bash
sudo mkdir -p /opt/10xcards
sudo chown $USER:$USER /opt/10xcards
cd /opt/10xcards
```
- [ ] Katalog utworzony

### Krok 2.3: Utwórz pliki secrets

**Ważne: Szczegółowy przewodnik w `VPS-ENV-GUIDE.md`**

```bash
# Utwórz secrets/supabase.env
nano /opt/10xcards/secrets/supabase.env
```

Minimalna zawartość (wygeneruj własne wartości!):
```env
POSTGRES_PASSWORD=twoje_haslo_postgres
JWT_SECRET=twoj_jwt_secret_min_32_znaki
JWT_EXPIRY=3600
ANON_KEY=twoj_anon_key_jwt
SERVICE_ROLE_KEY=twoj_service_role_key_jwt
SECRET_KEY_BASE=twoj_secret_key_base
```

```bash
# Utwórz secrets/app.env
nano /opt/10xcards/secrets/app.env
```

Zawartość:
```env
SUPABASE_KEY=ten_sam_anon_key_co_wyzej
SUPABASE_SERVICE_ROLE_KEY=ten_sam_service_role_key_co_wyzej
OPENROUTER_API_KEY=twoj_klucz_openrouter
```

**💡 Jak wygenerować wartości? Zobacz `VPS-ENV-GUIDE.md`**

```bash
# Ustaw uprawnienia
chmod 600 /opt/10xcards/secrets/*.env
```

- [ ] Plik `secrets/supabase.env` utworzony
- [ ] Plik `secrets/app.env` utworzony
- [ ] Uprawnienia ustawione

### Krok 2.4: Zaloguj się do GitHub Container Registry
```bash
# Wygeneruj token: https://github.com/settings/tokens
# Permissions: read:packages

echo "TWOJ_GITHUB_TOKEN" | docker login ghcr.io -u 4RV3 --password-stdin
```
- [ ] Zalogowano do GHCR

### Krok 2.5: Otwórz port w firewall
```bash
sudo ufw allow 8080/tcp
sudo ufw status
```
- [ ] Port 8080 otwarty

### Krok 2.6: Wyloguj się z VPS
```bash
exit
```

## ☑️ Etap 3: Testowanie Lokalne (opcjonalne, 5 min)

Na swoim komputerze:

```bash
# Test budowania
npm run build
- [ ] Build działa

# Test preview
npm run preview
# W przeglądarce: http://localhost:4321
- [ ] Preview działa

# Zainstaluj przeglądarki (jeśli jeszcze nie)
npx playwright install chromium
- [ ] Przeglądarki zainstalowane

# Uruchom testy
npm run test
- [ ] Testy przechodzą lokalnie
```

## ☑️ Etap 4: Deployment (5 min)

### Krok 4.1: Commit i push
```bash
git add .
git commit -m "Add CI/CD pipeline and E2E tests"
git push origin master
```
- [ ] Kod wypushowany

### Krok 4.2: Sprawdź pipeline
Otwórz: https://github.com/4RV3/10x-astro-starter/actions

Poczekaj na wykonanie wszystkich jobów:
- [ ] ✅ Build job - sukces
- [ ] ✅ Test job - sukces  
- [ ] ✅ Docker job - sukces
- [ ] ✅ Deploy job - sukces

### Krok 4.3: Weryfikacja
```bash
# Sprawdź z zewnątrz
curl http://example.com:8080/

# Lub w przeglądarce
open http://example.com:8080/
```
- [ ] Aplikacja działa na VPS

### Krok 4.4: Sprawdź logi (opcjonalnie)
```bash
ssh user@hostname -p port
cd /opt/10xcards
docker compose -f docker-compose.production.yml logs -f
```
- [ ] Logi wyglądają OK

## ✅ Gotowe!

Twoja aplikacja jest teraz:
- ✅ Automatycznie testowana przy każdym pushu
- ✅ Automatycznie deployowana na VPS
- ✅ Uruchomiona w kontenerze Docker

## 🔄 Następne deployment

Od teraz wystarczy:
```bash
git push origin master
```

Pipeline automatycznie:
1. Zbuduje aplikację
2. Uruchomi testy
3. Zdeployuje na VPS

## 📚 Dokumentacja

- **IMPLEMENTATION-SUMMARY.md** - co zostało zrobione
- **CI-CD-SETUP.md** - szczegółowa konfiguracja
- **TESTING.md** - jak pisać i uruchamiać testy

## 🆘 Problemy?

Sprawdź sekcje "Troubleshooting" w:
- `CI-CD-SETUP.md`
- `TESTING.md`

Lub sprawdź logi:
- GitHub Actions: https://github.com/4RV3/10x-astro-starter/actions
- VPS: `ssh user@hostname -p port "cd /opt/10xcards && docker compose -f docker-compose.production.yml logs"`
