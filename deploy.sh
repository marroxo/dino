#!/bin/bash
set -e

# ─────────────────────────────────────────────
#  VAPOR SHOP — Deploy Script
#  Repo: https://github.com/marroxo/dino
#  Server: 45.11.229.217:3500
# ─────────────────────────────────────────────

REPO_URL="https://github.com/marroxo/dino.git"
BRANCH="main"
APP_DIR="/var/www/dv"
APP_NAME="vapor-shop"
PORT=3500

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()    { echo -e "\n${YELLOW}──── $1 ────${NC}"; }

# ─── Provjera root ───
if [ "$EUID" -ne 0 ]; then
  warn "Skriptu pokreni kao root ili s 'sudo ./deploy.sh'"
fi

# ─── Provjera ovisnosti ───
step "Provjera alata"

command -v git  >/dev/null 2>&1 || error "git nije instaliran. Instaliraj: apt install git"
command -v node >/dev/null 2>&1 || error "Node.js nije instaliran. Instaliraj: https://nodejs.org"
command -v npm  >/dev/null 2>&1 || error "npm nije instaliran."

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  error "Node.js verzija mora biti >= 16. Trenutno: $(node -v)"
fi

info "git    : $(git --version)"
info "node   : $(node -v)"
info "npm    : $(npm -v)"

# ─── PM2 ───
step "Provjera PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  warn "PM2 nije instaliran. Instaliram..."
  npm install -g pm2
  info "PM2 instaliran: $(pm2 --version)"
else
  info "PM2 : $(pm2 --version)"
fi

# ─── Klon ili update repoa ───
step "Dohvacanje koda (marroxo/dino)"

if [ -d "$APP_DIR/.git" ]; then
  warn "Direktorij $APP_DIR vec postoji — radim git pull..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/$BRANCH
  info "Repo azuriran na zadnji commit."
else
  info "Klonam repo u $APP_DIR..."
  mkdir -p "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  info "Repo kloniran."
fi

# ─── npm install ───
step "Instalacija node paketa"
cd "$APP_DIR"
npm install --omit=dev
info "Paketi instalirani."

# ─── Firewall ───
step "Provjera firewall-a"
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -q "active"; then
    ufw allow "$PORT"/tcp >/dev/null 2>&1 && info "UFW: port $PORT otvoren."
  else
    warn "UFW nije aktivan — preskacam."
  fi
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$PORT"/tcp >/dev/null 2>&1
  firewall-cmd --reload >/dev/null 2>&1
  info "firewalld: port $PORT otvoren."
else
  warn "Nema poznatog firewall alata — provjeri rucno da je port $PORT otvoren."
fi

# ─── Pokretanje s PM2 ───
step "Pokretanje aplikacije (PM2)"
cd "$APP_DIR"

if pm2 list | grep -q "$APP_NAME"; then
  warn "Aplikacija vec radi — restartujem..."
  pm2 restart "$APP_NAME" --update-env
else
  PORT=$PORT pm2 start server.js \
    --name "$APP_NAME" \
    --env production \
    --
fi

# ─── PM2 startup (auto-start nakon reboota) ───
step "Postavljanje PM2 autostart-a"
pm2 save >/dev/null 2>&1

STARTUP_CMD=$(pm2 startup 2>/dev/null | grep "sudo" | tail -1)
if [ -n "$STARTUP_CMD" ]; then
  warn "Izvrsi sljedecu naredbu ako PM2 autostart jos nije postavljen:"
  echo -e "  ${YELLOW}${STARTUP_CMD}${NC}"
fi

# ─── Gotovo ───
echo ""
echo -e "${GREEN}┌─────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  VAPOR Shop je pokrenut!                    │${NC}"
echo -e "${GREEN}│  http://45.11.229.217:${PORT}                  │${NC}"
echo -e "${GREEN}│                                             │${NC}"
echo -e "${GREEN}│  pm2 logs ${APP_NAME}   → logovi           │${NC}"
echo -e "${GREEN}│  pm2 status              → status           │${NC}"
echo -e "${GREEN}│  pm2 restart ${APP_NAME} → restart         │${NC}"
echo -e "${GREEN}└─────────────────────────────────────────────┘${NC}"
echo ""
