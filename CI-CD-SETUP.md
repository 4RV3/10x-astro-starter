# CI/CD Setup Instructions

## Overview
Ten projekt ma skonfigurowany pipeline CI/CD, który automatycznie:
1. ✅ Buduje aplikację
2. 🧪 Uruchamia testy E2E (Playwright)
3. 🐳 Tworzy Docker image i wysyła do GitHub Container Registry
4. 🚀 Deployuje aplikację na VPS przez SSH

## Prerequisites na VPS
- Docker i Docker Compose zainstalowane
- Port 8080 otwarty w firewall
- Użytkownik z uprawnieniami do Docker

## GitHub Secrets Configuration

Musisz dodać następujące secrets w GitHub (Settings → Secrets and variables → Actions → New repository secret):

### 1. `VPS_SSH_KEY`
Klucz prywatny SSH do połączenia z VPS.

**Jak wygenerować:**
```bash
# Na swoim komputerze
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key

# Skopiuj klucz publiczny na VPS
ssh-copy-id -i ~/.ssh/github_actions_key.pub -p 10129 erntoto@srv26.mikr.us

# Wyświetl klucz prywatny i skopiuj całość (włącznie z BEGIN i END)
cat ~/.ssh/github_actions_key
```

Skopiuj całą zawartość klucza prywatnego do GitHub Secret `VPS_SSH_KEY`.

### 2. `VPS_HOST`
Wartość: `hostname`

### 3. `VPS_USER`
Wartość: `username`

### 4. `VPS_SSH_PORT`
Wartość: `port`

## Setup na VPS

### 1. Połącz się z VPS:
```bash
ssh user@hostname -p port
```

### 2. Utwórz katalog deploymentu:
```bash
sudo mkdir -p /opt/10xcards
sudo chown $USER:$USER /opt/10xcards
cd /opt/10xcards
```

### 3. Utwórz plik `.env.production`:
```bash
nano .env.production
```

Wklej i uzupełnij:
```env
NODE_ENV=production

# Twoje dane Supabase
SUPABASE_URL=https://twoj-projekt.supabase.co
SUPABASE_KEY=twoj_anon_key
SUPABASE_SERVICE_ROLE_KEY=twoj_service_role_key
```

### 4. Zaloguj się do GitHub Container Registry:
```bash
# Wygeneruj Personal Access Token na GitHub:
# Settings → Developer settings → Personal access tokens → Tokens (classic)
# Zaznacz: read:packages

echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 5. Otwórz port w firewall (jeśli używasz ufw):
```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

## Testowanie Lokalnie

### Uruchom testy:
```bash
npm run test
```

### Tryb interaktywny (UI):
```bash
npm run test:ui
```

### Debug mode:
```bash
npm run test:debug
```

### Build i preview (jak w CI):
```bash
npm run build
npm run preview
```

## Deployment Flow

### Automatyczny deployment:
1. Push do branch `main` lub `master`
2. GitHub Actions automatycznie:
   - Buduje aplikację
   - Uruchamia testy
   - Tworzy Docker image
   - Deployuje na VPS

### Ręczny deployment na VPS:
```bash
ssh user@hostname -p port
cd /opt/10xcards
./deploy.sh
```

## Sprawdzanie Stanu Aplikacji

### Na VPS:
```bash
# Status kontenerów
docker compose -f docker-compose.production.yml ps

# Logi aplikacji
docker compose -f docker-compose.production.yml logs -f

# Health check
curl http://localhost:8080/

# Restart
docker compose -f docker-compose.production.yml restart
```

### Zewnętrznie:
```bash
curl http://example.com:8080/
```

## Troubleshooting

### Problem: Deployment fails with "permission denied"
**Rozwiązanie:** Upewnij się, że klucz SSH jest poprawnie dodany do VPS:
```bash
ssh user@hostname -p port "cat ~/.ssh/authorized_keys"
```

### Problem: Container nie startuje
**Rozwiązanie:** Sprawdź logi:
```bash
docker compose -f docker-compose.production.yml logs
```

### Problem: Port 8080 zajęty
**Rozwiązanie:** Zmień port w `docker-compose.production.yml`:
```yaml
ports:
  - "NOWY_PORT:8080"
```

### Problem: Brak obrazu w registry
**Rozwiązanie:** Sprawdź czy pipeline się wykonał w GitHub Actions i czy image został wysłany.
Packages powinny być widoczne tutaj: https://github.com/4RV3?tab=packages

## Dostęp do Aplikacji

Po udanym deploymencie aplikacja będzie dostępna pod:
- **Lokalnie na VPS:** `http://localhost:8080`
- **Zewnętrznie:** `http://example.com:8080`

## Monitoring

### Ciągłe monitorowanie logów:
```bash
ssh user@hostname -p port "cd /opt/10xcards && docker compose -f docker-compose.production.yml logs -f"
```

### Health check:
```bash
watch -n 5 'curl -s -o /dev/null -w "%{http_code}\n" http://example.com:8080/'
```

## Rollback

Jeśli deployment się nie udał:
```bash
ssh user@hostname -p port
cd /opt/10xcards

# Wróć do poprzedniej wersji
docker compose -f docker-compose.production.yml down
docker pull ghcr.io/twoj-repo:previous-tag
docker compose -f docker-compose.production.yml up -d
```
