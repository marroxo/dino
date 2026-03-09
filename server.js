const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3500;
const DATA_FILE = path.join(__dirname, 'data.json');

// ===== DATA HELPERS =====
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== SIMPLE SESSION (in-memory) =====
const sessions = new Map();
const ADMIN_USER = 'dino';
const ADMIN_PASS = 'dino';
const SESSION_COOKIE = 'vapor_admin_sid';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const cookies = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });
  return cookies;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ===== ADMIN AUTH ROUTES =====
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateToken();
    sessions.set(token, { username, createdAt: Date.now() });
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict`);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Pogrešan username ili lozinka' });
});

app.post('/admin/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/admin/check', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  res.json({ loggedIn: !!(token && sessions.has(token)) });
});

// ===== PUBLIC API =====
app.get('/api/products', (req, res) => {
  res.json(readData().products);
});

app.get('/api/poll', (req, res) => {
  res.json(readData().pollData);
});

app.get('/api/settings', (req, res) => {
  res.json(readData().settings);
});

app.get('/api/novosti', (req, res) => {
  const data = readData();
  res.json(data.novosti.filter(n => n.active));
});

// ===== ADMIN API — PRODUCTS =====
app.get('/api/admin/products', requireAuth, (req, res) => {
  res.json(readData().products);
});

app.post('/api/admin/products', requireAuth, (req, res) => {
  const data = readData();
  const { model, name, flavors, price, stock, colorIdx } = req.body;
  const newId = data.products.length > 0 ? Math.max(...data.products.map(p => p.id)) + 1 : 1;
  const product = {
    id: newId,
    model: model || '',
    name: name || '',
    flavors: Array.isArray(flavors) ? flavors : (flavors || '').split(',').map(f => f.trim()).filter(Boolean),
    price: parseFloat(price) || 0,
    stock: stock || 'available',
    colorIdx: parseInt(colorIdx) || 0
  };
  data.products.push(product);
  writeData(data);
  res.json(product);
});

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  const idx = data.products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { model, name, flavors, price, stock, colorIdx } = req.body;
  data.products[idx] = {
    ...data.products[idx],
    model: model ?? data.products[idx].model,
    name: name ?? data.products[idx].name,
    flavors: Array.isArray(flavors) ? flavors : (flavors || '').split(',').map(f => f.trim()).filter(Boolean),
    price: parseFloat(price) ?? data.products[idx].price,
    stock: stock ?? data.products[idx].stock,
    colorIdx: colorIdx !== undefined ? parseInt(colorIdx) : data.products[idx].colorIdx
  };
  writeData(data);
  res.json(data.products[idx]);
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  data.products = data.products.filter(p => p.id !== id);
  writeData(data);
  res.json({ ok: true });
});

// ===== ADMIN API — POLL =====
app.get('/api/admin/poll', requireAuth, (req, res) => {
  res.json(readData().pollData);
});

app.put('/api/admin/poll', requireAuth, (req, res) => {
  const data = readData();
  data.pollData = req.body; // full array replacement
  writeData(data);
  res.json(data.pollData);
});

app.put('/api/admin/poll/:idx', requireAuth, (req, res) => {
  const data = readData();
  const idx = parseInt(req.params.idx);
  if (idx < 0 || idx >= data.pollData.length) return res.status(404).json({ error: 'Not found' });
  const { emoji, name, votes } = req.body;
  data.pollData[idx] = {
    emoji: emoji ?? data.pollData[idx].emoji,
    name: name ?? data.pollData[idx].name,
    votes: votes !== undefined ? parseInt(votes) : data.pollData[idx].votes
  };
  writeData(data);
  res.json(data.pollData[idx]);
});

app.post('/api/admin/poll', requireAuth, (req, res) => {
  const data = readData();
  const { emoji, name, votes } = req.body;
  data.pollData.push({ emoji: emoji || '❓', name: name || '', votes: parseInt(votes) || 0 });
  writeData(data);
  res.json(data.pollData);
});

app.delete('/api/admin/poll/:idx', requireAuth, (req, res) => {
  const data = readData();
  const idx = parseInt(req.params.idx);
  data.pollData.splice(idx, 1);
  writeData(data);
  res.json({ ok: true });
});

// ===== ADMIN API — SETTINGS =====
app.get('/api/admin/settings', requireAuth, (req, res) => {
  res.json(readData().settings);
});

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  res.json(data.settings);
});

// ===== ADMIN API — NOVOSTI =====
app.get('/api/admin/novosti', requireAuth, (req, res) => {
  res.json(readData().novosti);
});

app.post('/api/admin/novosti', requireAuth, (req, res) => {
  const data = readData();
  const { badge, tekst, datum, active } = req.body;
  const newId = data.novosti.length > 0 ? Math.max(...data.novosti.map(n => n.id)) + 1 : 1;
  const novost = {
    id: newId,
    badge: badge || 'novo',
    tekst: tekst || '',
    datum: datum || new Date().toLocaleDateString('hr-HR'),
    active: active !== false
  };
  data.novosti.push(novost);
  writeData(data);
  res.json(novost);
});

app.put('/api/admin/novosti/:id', requireAuth, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  const idx = data.novosti.findIndex(n => n.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.novosti[idx] = { ...data.novosti[idx], ...req.body, id };
  writeData(data);
  res.json(data.novosti[idx]);
});

app.delete('/api/admin/novosti/:id', requireAuth, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  data.novosti = data.novosti.filter(n => n.id !== id);
  writeData(data);
  res.json({ ok: true });
});

// ===== STATIC + ADMIN PANEL =====
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VAPOR Shop running on http://0.0.0.0:${PORT}`);
  console.log(`Admin panel: http://0.0.0.0:${PORT}/admin`);
});
