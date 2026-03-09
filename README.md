# VAPOR — Vape Shop Web Stranica

Minimalistična dark-theme web stranica za vape shop. Node.js + Express, single-page app.

## Pokretanje lokalno

```bash
npm install
npm start
```

Stranica će biti dostupna na `http://localhost:3500`.

## Deployment na VPS (45.11.229.217:3500)

### 1. Kopiraj projekt na server

```bash
# S lokalnog računala:
scp -r . user@45.11.229.217:/var/www/vapor
```

Ili kloniraj repo direktno:

```bash
ssh user@45.11.229.217
git clone <repo-url> /var/www/vapor
```

### 2. Instaliraj dependencies i pokreni

```bash
cd /var/www/vapor
npm install
npm start
```

### 3. Pokretanje u pozadini (preporučeno: PM2)

```bash
# Instaliraj PM2 globalno
npm install -g pm2

# Pokreni aplikaciju
pm2 start server.js --name vapor-shop

# Automatski restart pri rebootu servera
pm2 startup
pm2 save
```

Korisne PM2 naredbe:

```bash
pm2 status          # status aplikacija
pm2 logs vapor-shop # prikaz logova
pm2 restart vapor-shop
pm2 stop vapor-shop
```

### 4. Firewall — otvori port 3500

```bash
# UFW (Ubuntu/Debian)
ufw allow 3500/tcp

# iptables
iptables -A INPUT -p tcp --dport 3500 -j ACCEPT
```

### 5. (Opcionalno) Nginx reverse proxy

Ako zelis koristiti standardni port 80/443 s Nginxom:

```nginx
server {
    listen 80;
    server_name 45.11.229.217;

    location / {
        proxy_pass http://localhost:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Testiraj konfiguraciju i restartaj Nginx
nginx -t
systemctl restart nginx
```

## Struktura projekta

```
vapor/
├── public/
│   └── index.html     # Cijela SPA (HTML + CSS + JS)
├── server.js          # Express static server
├── package.json
└── README.md
```

## Dodavanje backend funkcionalnosti

Forma za rezervaciju salje podatke simulirano. Za pravo slanje, u `index.html` otkomentiraj `fetch` poziv i dodaj Express rutu u `server.js`:

```js
// server.js — dodaj ispod statickog servera:
app.use(express.json());

app.post('/api/rezervacija', (req, res) => {
  const { name, phone, email, cart } = req.body;
  // Ovdje spremi u bazu, posalji email/WhatsApp notifikaciju...
  console.log('Nova rezervacija:', { name, phone, email, cart });
  res.json({ ok: true });
});
```

## Zahtjevi

- Node.js >= 16
- npm >= 7
