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

// ===== PUBLIC API — ORDERS =====
app.post('/api/orders', (req, res) => {
  const data = readData();
  const { ime, email, tel, napomena, stavke, ukupno, placanje } = req.body;
  if (!ime || !tel || !stavke || !placanje) {
    return res.status(400).json({ error: 'Nedostaju podaci' });
  }
  const id = data.orders.length > 0 ? Math.max(...data.orders.map(o => o.id)) + 1 : 1;
  const broj = `VPR-${String(id).padStart(3, '0')}`;
  const datum = new Date().toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' });
  const order = { id, broj, ime, email: email || '', tel, napomena: napomena || '', stavke, ukupno, placanje, status: 'ceka_placanje', datum };
  data.orders.push(order);
  writeData(data);
  res.json({ ok: true, id, broj });
});

// ===== ADMIN API — ORDERS =====
app.get('/api/admin/orders', requireAuth, (req, res) => {
  res.json(readData().orders.slice().reverse());
});

app.put('/api/admin/orders/:id', requireAuth, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  const idx = data.orders.findIndex(o => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const allowed = ['status', 'napomena'];
  allowed.forEach(k => { if (req.body[k] !== undefined) data.orders[idx][k] = req.body[k]; });
  writeData(data);
  res.json(data.orders[idx]);
});

app.delete('/api/admin/orders/:id', requireAuth, (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  data.orders = data.orders.filter(o => o.id !== id);
  writeData(data);
  res.json({ ok: true });
});

// ===== ADMIN API — AI CHAT =====
app.post('/api/admin/ai-chat', requireAuth, (req, res) => {
  const data = readData();
  const msg = (req.body.poruka || '').trim().toLowerCase().replace(/[čć]/g, 'c').replace(/[šs]/g, function(m){ return m === 'š' ? 's' : m; }).replace(/ž/g, 'z').replace(/đ/g, 'd');

  // normalize helper for comparison
  const norm = s => s.toLowerCase()
    .replace(/č|ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd');
  const input = norm(req.body.poruka || '');

  // Extract order id from message
  const idMatch = input.match(/\b(\d+)\b/);
  const orderId = idMatch ? parseInt(idMatch[1]) : null;

  const order = orderId ? data.orders.find(o => o.id === orderId || o.broj === `VPR-${String(orderId).padStart(3,'0')}`) : null;

  function orderCard(o) {
    const statusLabel = { ceka_placanje: '⏳ Čeka plaćanje', placeno: '✅ Plaćeno', otkazano: '❌ Otkazano' };
    const placLabel = { bank: '🏦 Bank transfer', paypal: '💳 PayPal', uzivo: '🤝 Uživo' };
    const lines = o.stavke.map(s => `  · ${s.model} × ${s.kolicina} — €${(s.cijena * s.kolicina).toFixed(2)}`).join('\n');
    return `**${o.broj}** — ${o.ime}\n📞 ${o.tel}${o.email ? ' | 📧 ' + o.email : ''}\n${lines}\n💰 Ukupno: **€${parseFloat(o.ukupno).toFixed(2)}**\n${placLabel[o.placanje] || o.placanje} | ${statusLabel[o.status] || o.status}\n📅 ${o.datum}${o.napomena ? '\n📝 ' + o.napomena : ''}`;
  }

  // --- Command matching ---
  // mark paid
  if (order && /plac[ae]n/i.test(input) && /markir|oznac|postavi|stavi/i.test(input.replace(/[čćšžđ]/g, ''))) {
    data.orders.find(o => o.id === order.id).status = 'placeno';
    writeData(data);
    return res.json({ odgovor: `✅ Narudžba **${order.broj}** označena kao **plaćena**.\n\n${orderCard({ ...order, status: 'placeno' })}` });
  }
  // mark cancelled
  if (order && /otka[zž]/i.test(input) && /markir|oznac|postavi|stavi/i.test(input)) {
    data.orders.find(o => o.id === order.id).status = 'otkazano';
    writeData(data);
    return res.json({ odgovor: `❌ Narudžba **${order.broj}** označena kao **otkazana**.\n\n${orderCard({ ...order, status: 'otkazano' })}` });
  }
  // mark pending
  if (order && /cek[ao]|pending|na cekan/i.test(input)) {
    data.orders.find(o => o.id === order.id).status = 'ceka_placanje';
    writeData(data);
    return res.json({ odgovor: `⏳ Narudžba **${order.broj}** vraćena na **čekanje**.` });
  }
  // add note
  const biljeskaMatch = (req.body.poruka || '').match(/biljesk[ae]\s+(.+)/i);
  if (order && biljeskaMatch) {
    const napomena = biljeskaMatch[1].trim();
    data.orders.find(o => o.id === order.id).napomena = napomena;
    writeData(data);
    return res.json({ odgovor: `📝 Bilješka dodana na narudžbu **${order.broj}**: "${napomena}"` });
  }
  // show single order
  if (order) {
    return res.json({ odgovor: orderCard(order) });
  }
  // list unpaid
  if (/neplac|neplacen|cekaju|cek[ao] plac/.test(input)) {
    const unpaid = data.orders.filter(o => o.status === 'ceka_placanje');
    if (!unpaid.length) return res.json({ odgovor: '✅ Nema narudžbi koje čekaju plaćanje.' });
    return res.json({ odgovor: `⏳ **${unpaid.length} narudžbi čeka plaćanje:**\n\n` + unpaid.slice(0,10).map(o => `· **${o.broj}** — ${o.ime} — €${parseFloat(o.ukupno).toFixed(2)} — ${o.datum}`).join('\n') });
  }
  // list paid
  if (/placen[ae]|placeno/.test(input)) {
    const paid = data.orders.filter(o => o.status === 'placeno');
    if (!paid.length) return res.json({ odgovor: '📭 Nema plaćenih narudžbi.' });
    return res.json({ odgovor: `✅ **${paid.length} plaćenih narudžbi:**\n\n` + paid.slice(0,10).map(o => `· **${o.broj}** — ${o.ime} — €${parseFloat(o.ukupno).toFixed(2)}`).join('\n') });
  }
  // stats
  if (/statist|pregled|ukupno|prihod/.test(input)) {
    const total = data.orders.length;
    const paid = data.orders.filter(o => o.status === 'placeno').length;
    const pending = data.orders.filter(o => o.status === 'ceka_placanje').length;
    const cancelled = data.orders.filter(o => o.status === 'otkazano').length;
    const revenue = data.orders.filter(o => o.status === 'placeno').reduce((s, o) => s + parseFloat(o.ukupno), 0);
    return res.json({ odgovor: `📊 **Statistika narudžbi:**\n\n· Ukupno narudžbi: **${total}**\n· Plaćeno: **${paid}**\n· Na čekanju: **${pending}**\n· Otkazano: **${cancelled}**\n· Prihod (plaćene): **€${revenue.toFixed(2)}**` });
  }
  // list all
  if (/sve narud|sve nardz|svi|nardzb[ei]|narudb/.test(input) || /^narud/.test(input)) {
    const orders = data.orders.slice().reverse().slice(0, 10);
    if (!orders.length) return res.json({ odgovor: '📭 Nema narudžbi.' });
    const statusEmoji = { ceka_placanje: '⏳', placeno: '✅', otkazano: '❌' };
    return res.json({ odgovor: `📋 **Zadnjih ${orders.length} narudžbi:**\n\n` + orders.map(o => `${statusEmoji[o.status]||'·'} **${o.broj}** — ${o.ime} — €${parseFloat(o.ukupno).toFixed(2)} — ${o.datum}`).join('\n') });
  }
  // help
  return res.json({ odgovor: `👋 Kako mogu pomoći? Primjeri naredbi:\n\n· \`narudžba 3 markiraj plaćeno\`\n· \`narudžba 3 markiraj otkazano\`\n· \`narudžba 3 bilješka pozovite u 18h\`\n· \`narudžba 3\` — detalji narudžbe\n· \`sve narudžbe\` — lista svih\n· \`neplačene narudžbe\`\n· \`statistika\`` });
});

// ===== PAYPAL IPN WEBHOOK =====
app.post('/api/paypal/ipn', async (req, res) => {
  // Acknowledge to PayPal immediately
  res.status(200).send('OK');
  try {
    const params = new URLSearchParams(req.body);
    params.set('cmd', '_notify-validate');
    const verify = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const verifyText = await verify.text();
    if (verifyText !== 'VERIFIED') return;

    const paymentStatus = req.body.payment_status;
    const custom = req.body.custom || '';      // order id stored in custom field
    const itemName = req.body.item_name || ''; // fallback: "VPR-001" in item name

    if (paymentStatus !== 'Completed') return;

    const orderId = parseInt(custom) || parseInt((itemName.match(/VPR-(\d+)/) || [])[1]);
    if (!orderId) return;

    const data = readData();
    const idx = data.orders.findIndex(o => o.id === orderId);
    if (idx !== -1 && data.orders[idx].status === 'ceka_placanje') {
      data.orders[idx].status = 'placeno';
      writeData(data);
      console.log(`[PayPal IPN] Narudžba VPR-${String(orderId).padStart(3,'0')} automatski označena kao plaćena`);
    }
  } catch (err) {
    console.error('[PayPal IPN] Error:', err.message);
  }
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
