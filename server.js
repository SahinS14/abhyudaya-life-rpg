require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const app = express();
const port = Number(process.env.PORT || 3000);
const secret = process.env.JWT_SECRET || 'development-only-change-me-before-production';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || secret === 'development-only-change-me-before-production')) {
  throw new Error('JWT_SECRET must be set to a long, unique value in production.');
}
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'lifequest.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON;');
app.disable('x-powered-by');
app.set('trust proxy', 1);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS characters (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'New Operative', class_name TEXT NOT NULL DEFAULT 'Seeker',
    level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 0,
    strength INTEGER NOT NULL DEFAULT 1, intellect INTEGER NOT NULL DEFAULT 1,
    focus INTEGER NOT NULL DEFAULT 1, discipline INTEGER NOT NULL DEFAULT 1,
    vitality INTEGER NOT NULL DEFAULT 1, creativity INTEGER NOT NULL DEFAULT 1,
    origin_story TEXT NOT NULL DEFAULT '', directives_json TEXT NOT NULL DEFAULT '[]',
    protocol TEXT NOT NULL DEFAULT 'balanced', onboarding_completed INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0, longest_streak INTEGER NOT NULL DEFAULT 0,
    last_completed_on TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', attribute TEXT NOT NULL,
    xp_reward INTEGER NOT NULL, gold_reward INTEGER NOT NULL, frequency TEXT NOT NULL DEFAULT 'daily',
    due_date TEXT, completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, message TEXT NOT NULL, xp_delta INTEGER NOT NULL DEFAULT 0,
    gold_delta INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS shop_items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
    price INTEGER NOT NULL, category TEXT NOT NULL, icon TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inventory (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES shop_items(id), purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    equipped INTEGER NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    sound_enabled INTEGER NOT NULL DEFAULT 1, reduced_motion INTEGER NOT NULL DEFAULT 0,
    theme TEXT NOT NULL DEFAULT 'cyberpunk', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ascension_claims (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL, claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, level)
  );
  CREATE TABLE IF NOT EXISTS achievement_claims (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
  );
  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, token_prefix TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT
  );
  CREATE TABLE IF NOT EXISTS guild_contributions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS guild_state (id INTEGER PRIMARY KEY CHECK (id=1), treasury_gold INTEGER NOT NULL DEFAULT 0, mana INTEGER NOT NULL DEFAULT 0);
`);
db.prepare('INSERT OR IGNORE INTO guild_state (id) VALUES (1)').run();

// Keep early local databases compatible; new databases receive these fields in the schema above.
for (const migration of [
  'ALTER TABLE characters ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE characters ADD COLUMN vitality INTEGER NOT NULL DEFAULT 1;',
  'ALTER TABLE characters ADD COLUMN creativity INTEGER NOT NULL DEFAULT 1;',
  "ALTER TABLE characters ADD COLUMN origin_story TEXT NOT NULL DEFAULT '';",
  "ALTER TABLE characters ADD COLUMN directives_json TEXT NOT NULL DEFAULT '[]';",
  "ALTER TABLE characters ADD COLUMN protocol TEXT NOT NULL DEFAULT 'balanced';",
  'ALTER TABLE inventory ADD COLUMN equipped INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE inventory ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;'
]) { try { db.exec(migration); } catch { /* Column already exists. */ } }

const items = [
  ['hyperfocus-potion', 'Potion of Hyperfocus', 'A focus boost for your next quest.', 120, 'consumable', '🧪'],
  ['obsidian-helm', 'Cyber-Arcane Obsidian Helm', 'A prestige profile relic.', 850, 'relic', '⛑️'],
  ['neon-terminal', 'Neon Terminal Theme', 'Unlock a luminous command-centre theme.', 450, 'theme', '⌘'],
  ['discipline-badge', 'Iron Discipline Badge', 'A badge for relentless operatives.', 300, 'badge', '✦']
  ,['item-1', 'Potion of Hyperfocus', 'A focus boost for your next quest.', 250, 'consumable', '🧪']
  ,['item-2', 'Cyber-Arcane Obsidian Helm', 'A prestige profile relic.', 1200, 'relic', '⛑️']
  ,['item-3', 'Neon Synthwave UI Theme', 'Unlock a luminous command-centre theme.', 850, 'theme', '⌘']
  ,['item-4', 'Streak Shield Aegis', 'Protect your hard-won habit streak.', 1500, 'booster', '🛡️']
  ,['item-5', 'Aura of the Sunstrider', 'A radiant prestige aura.', 2200, 'aura', '☀️']
  ,['item-6', 'Scroll of Attribute Respec', 'Reconsider your attribute path.', 400, 'consumable', '📜']
  ,['ascension-cache', 'Ascension Cache', 'Proof of a completed level ascension.', 0, 'badge', '⚡']
];
const seed = db.prepare('INSERT OR IGNORE INTO shop_items (id, name, description, price, category, icon) VALUES (?, ?, ?, ?, ?, ?)');
items.forEach(item => seed.run(...item));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '100kb' }));
// During local development, always serve the newest client scripts after a server restart.
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.get('/api/health', (req, res) => {
  const tables = ['users', 'characters', 'tasks', 'activity_logs', 'shop_items', 'inventory'];
  res.json({ status: 'ok', database: 'sqlite', tables: Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count])) });
});
app.use((req, res, next) => {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => {
    const i = v.indexOf('='); return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))];
  }));
  req.cookies = cookies;
  next();
});

function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, secret, { expiresIn: '7d' });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `lifequest_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
  return token;
}
function authenticate(req, res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  for (const candidate of [req.cookies.lifequest_session, bearer].filter(Boolean)) {
    try { req.userId = jwt.verify(candidate, secret).sub; return next(); } catch { /* Try the next valid session source. */ }
  }
  res.status(401).json({ error: 'Authentication required.' });
}
function id() { return crypto.randomUUID(); }
function levelFor(xp) { return Math.floor((1 + Math.sqrt(1 + (xp * 8) / 100)) / 2); }
function xpForNext(level) { return 100 * level * level; }
function safeTask(row) { return { ...row, completed: Boolean(row.completed_at) }; }
function character(userId) { return db.prepare('SELECT * FROM characters WHERE user_id = ?').get(userId); }
function log(userId, type, message, xp = 0, gold = 0) {
  db.prepare('INSERT INTO activity_logs (id,user_id,type,message,xp_delta,gold_delta) VALUES (?,?,?,?,?,?)').run(id(), userId, type, message, xp, gold);
}

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || 'New Operative').trim().slice(0, 40);
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Use a valid email and a password of at least 8 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'That email is already registered.' });
  const userId = id();
  db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').run(userId, email, await bcrypt.hash(password, 12));
  db.prepare('INSERT INTO characters (user_id,name) VALUES (?,?)').run(userId, name || 'New Operative');
  log(userId, 'account', 'Entered the Abhyudaya realm.');
  const sessionToken = setSession(res, userId);
  res.status(201).json({ user: { id: userId, email }, character: character(userId), sessionToken });
});
app.post('/api/onboarding/complete', authenticate, (req, res) => {
  const hero = character(req.userId);
  if (hero.onboarding_completed) return res.json({ character: hero });
  const name = String(req.body.name || hero.name).trim().slice(0, 40) || 'New Operative';
  const allowedClasses = ['Technomancer', 'Cyber Paladin', 'Neural Rogue', 'Chrono Alchemist'];
  const className = allowedClasses.includes(req.body.class_name) ? req.body.class_name : 'Technomancer';
  const origin = String(req.body.origin_story || '').trim().slice(0, 500);
  const directives = Array.isArray(req.body.directives) ? req.body.directives.filter(v => typeof v === 'string').slice(0, 4) : [];
  const protocol = ['casual', 'balanced', 'hardcore'].includes(req.body.protocol) ? req.body.protocol : 'balanced';
  const rawStats = req.body.stats && typeof req.body.stats === 'object' ? req.body.stats : {};
  const statKeys = { int:'intellect', foc:'focus', dis:'discipline', vit:'vitality', str:'strength', cre:'creativity' };
  const stats = Object.fromEntries(Object.entries(statKeys).map(([client, column]) => [column, Math.max(1, Math.min(20, Number(rawStats[client] || 1)))]));
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  if (total > 80) return res.status(400).json({ error: 'Attribute sync exceeds the available genesis allocation.' });
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE characters SET name=?, class_name=?, intellect=?, focus=?, discipline=?, vitality=?, strength=?, creativity=?, origin_story=?, directives_json=?, protocol=?, onboarding_completed=1, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(name, className, stats.intellect, stats.focus, stats.discipline, stats.vitality, stats.strength, stats.creativity, origin, JSON.stringify(directives), protocol, req.userId);
    const starter = db.prepare('INSERT INTO tasks (id,user_id,title,description,attribute,xp_reward,gold_reward,frequency) VALUES (?,?,?,?,?,?,?,?)');
    [
      ['Refactor Payment Microservice', 'Isolate webhooks and validate the service boundary.', 'intellect', 180, 45],
      ['Morning Mobility & 5km Run', 'Complete today’s movement protocol.', 'strength', 100, 25],
      ['Complete System Design Chapter 4', 'Study and capture the key architecture decisions.', 'intellect', 100, 25],
      ['Hydration & Nutrition Protocol: 3L Water', 'Complete your daily health protocol.', 'discipline', 50, 10]
    ].forEach(([title, description, attribute, xp, gold]) => starter.run(id(), req.userId, title, description, attribute, xp, gold, 'daily'));
    log(req.userId, 'character', `Forged ${name}, ${className}.`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.status(201).json({ character: character(req.userId) });
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  const sessionToken = setSession(res, user.id);
  res.json({ user: { id: user.id, email: user.email }, character: character(user.id), sessionToken });
});
app.post('/api/auth/logout', (req, res) => { res.setHeader('Set-Cookie', 'lifequest_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end(); });
app.post('/api/account/rebirth', authenticate, (req, res) => {
  if (req.body.confirmation !== 'REBIRTH') return res.status(400).json({ error: 'Type REBIRTH to confirm this reset.' });
  db.exec('BEGIN');
  try { db.prepare('DELETE FROM tasks WHERE user_id=?').run(req.userId); db.prepare('DELETE FROM inventory WHERE user_id=?').run(req.userId); db.prepare('DELETE FROM activity_logs WHERE user_id=?').run(req.userId); db.prepare('DELETE FROM achievement_claims WHERE user_id=?').run(req.userId); db.prepare('DELETE FROM ascension_claims WHERE user_id=?').run(req.userId); db.prepare("UPDATE characters SET level=1,xp=0,gold=0,strength=1,intellect=1,focus=1,discipline=1,vitality=1,creativity=1,current_streak=0,longest_streak=0,last_completed_on=NULL,onboarding_completed=0,origin_story='',directives_json='[]' WHERE user_id=?").run(req.userId); log(req.userId,'account','Began a new Abhyudaya cycle.'); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ character: character(req.userId) });
});
app.delete('/api/account', authenticate, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.userId);
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error: 'Confirm with your current password.' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.userId); res.setHeader('Set-Cookie', 'lifequest_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end();
});
app.post('/api/tokens', authenticate, (req, res) => {
  const token = `abh_${crypto.randomBytes(24).toString('base64url')}`;
  db.prepare('INSERT INTO api_tokens (id,user_id,token_hash,token_prefix) VALUES (?,?,?,?)').run(id(),req.userId,crypto.createHash('sha256').update(token).digest('hex'),token.slice(0,10));
  res.status(201).json({ token, message:'Copy this key now; it cannot be retrieved again.' });
});
app.get('/api/tokens', authenticate, (req,res) => res.json(db.prepare('SELECT id,token_prefix,created_at,revoked_at FROM api_tokens WHERE user_id=? ORDER BY created_at DESC').all(req.userId)));
app.post('/api/guild/contribute', authenticate, (req,res) => {
  const kind = req.body.kind === 'mana' ? 'mana' : 'gold', amount = kind === 'mana' ? 5 : Math.max(1, Math.min(1000, Number(req.body.amount || 0)));
  if (!Number.isInteger(amount)) return res.status(400).json({ error:'Invalid contribution.' });
  if (kind === 'gold' && character(req.userId).gold < amount) return res.status(409).json({ error:'Not enough Gold.' });
  db.exec('BEGIN'); try { if (kind === 'gold') db.prepare('UPDATE characters SET gold=gold-? WHERE user_id=?').run(amount,req.userId); db.prepare(`UPDATE guild_state SET ${kind === 'gold' ? 'treasury_gold' : 'mana'}=${kind === 'gold' ? 'treasury_gold' : 'mana'}+? WHERE id=1`).run(amount); db.prepare('INSERT INTO guild_contributions (id,user_id,kind,amount) VALUES (?,?,?,?)').run(id(),req.userId,kind,amount); log(req.userId,'guild',`Contributed ${amount} ${kind === 'gold' ? 'Gold' : 'Mana'} to the guild.`,0,kind === 'gold' ? -amount : 0); db.exec('COMMIT'); } catch(error) { db.exec('ROLLBACK'); throw error; }
  res.json({ state:db.prepare('SELECT * FROM guild_state WHERE id=1').get(), character:character(req.userId) });
});
app.get('/api/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id,email,created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ user, character: character(req.userId) });
});
app.patch('/api/character', authenticate, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  const className = String(req.body.class_name || '').trim().slice(0, 40);
  if (!name && !className) return res.status(400).json({ error: 'Provide a character name or class.' });
  const current = character(req.userId);
  db.prepare('UPDATE characters SET name=?, class_name=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(name || current.name, className || current.class_name, req.userId);
  log(req.userId, 'profile', 'Updated operative identity.');
  res.json(character(req.userId));
});
app.get('/api/settings', authenticate, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(req.userId);
  res.json(db.prepare('SELECT sound_enabled, reduced_motion, theme FROM user_settings WHERE user_id=?').get(req.userId));
});
app.patch('/api/settings', authenticate, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(req.userId);
  const existing = db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(req.userId);
  const sound = req.body.sound_enabled === undefined ? existing.sound_enabled : Number(Boolean(req.body.sound_enabled));
  const motion = req.body.reduced_motion === undefined ? existing.reduced_motion : Number(Boolean(req.body.reduced_motion));
  const theme = ['cyberpunk','midnight'].includes(req.body.theme) ? req.body.theme : existing.theme;
  db.prepare('UPDATE user_settings SET sound_enabled=?, reduced_motion=?, theme=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(sound, motion, theme, req.userId);
  res.json(db.prepare('SELECT sound_enabled, reduced_motion, theme FROM user_settings WHERE user_id=?').get(req.userId));
});
app.get('/api/progression', authenticate, (req, res) => {
  const hero = character(req.userId), completed = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE user_id=? AND completed_at IS NOT NULL').get(req.userId).count;
  const currentFloor = hero.level <= 1 ? 0 : 100 * (hero.level - 1) * (hero.level - 1);
  const next = xpForNext(hero.level);
  res.json({ character: hero, completedQuests: completed, xpForLevel: currentFloor, xpForNext: next, levelProgress: Math.max(0, Math.min(100, Math.round(((hero.xp-currentFloor)/(next-currentFloor))*100))) });
});
app.get('/api/achievements', authenticate, (req, res) => {
  const hero = character(req.userId), completed = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE user_id=? AND completed_at IS NOT NULL').get(req.userId).count;
  const inventoryCount = db.prepare('SELECT COUNT(*) AS count FROM inventory WHERE user_id=?').get(req.userId).count;
  const claimed = new Set(db.prepare('SELECT achievement_id FROM achievement_claims WHERE user_id=?').all(req.userId).map(row => row.achievement_id));
  const achievements = [
    { id:'first-quest', title:'First Signal', description:'Complete your first quest.', unlocked:completed>=1, progress:Math.min(completed,1), target:1, gold_reward:50 },
    { id:'centurion', title:'Centurion of Focus', description:'Complete 100 quests.', unlocked:completed>=100, progress:Math.min(completed,100), target:100, gold_reward:500 },
    { id:'streak-7', title:'Week of Will', description:'Maintain a 7-day streak.', unlocked:hero.longest_streak>=7, progress:Math.min(hero.longest_streak,7), target:7, gold_reward:100 },
    { id:'collector', title:'Armory Initiate', description:'Acquire 3 rewards.', unlocked:inventoryCount>=3, progress:Math.min(inventoryCount,3), target:3, gold_reward:100 },
    { id:'ascendant', title:'Ascendant', description:'Reach level 10.', unlocked:hero.level>=10, progress:Math.min(hero.level,10), target:10, gold_reward:350 }
  ].map(item => ({ ...item, claimed: claimed.has(item.id) }));
  res.json({ completedQuests: completed, achievements });
});
app.post('/api/achievements/:id/claim', authenticate, (req, res) => {
  const id = req.params.id;
  const hero = character(req.userId), completed = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE user_id=? AND completed_at IS NOT NULL').get(req.userId).count;
  const inventoryCount = db.prepare('SELECT COUNT(*) AS count FROM inventory WHERE user_id=?').get(req.userId).count;
  const conditions = { 'first-quest': completed >= 1, centurion: completed >= 100, 'streak-7': hero.longest_streak >= 7, collector: inventoryCount >= 3, ascendant: hero.level >= 10 };
  const rewards = { 'first-quest':50, centurion:500, 'streak-7':100, collector:100, ascendant:350 };
  if (!(id in conditions)) return res.status(404).json({ error: 'Achievement not found.' });
  if (!conditions[id]) return res.status(409).json({ error: 'This achievement is not unlocked yet.' });
  if (db.prepare('SELECT 1 FROM achievement_claims WHERE user_id=? AND achievement_id=?').get(req.userId,id)) return res.status(409).json({ error: 'Reward already claimed.' });
  db.exec('BEGIN');
  try { db.prepare('INSERT INTO achievement_claims (user_id,achievement_id) VALUES (?,?)').run(req.userId,id); db.prepare('UPDATE characters SET gold=gold+? WHERE user_id=?').run(rewards[id],req.userId); log(req.userId,'achievement',`Claimed achievement reward: ${id}.`,0,rewards[id]); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.status(201).json({ character:character(req.userId), gold_reward:rewards[id] });
});

app.get('/api/tasks', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY completed_at IS NOT NULL, created_at DESC').all(req.userId).map(safeTask));
});
app.post('/api/tasks', authenticate, (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  const attribute = String(req.body.attribute || 'focus').toLowerCase();
  const allowed = ['strength', 'intellect', 'focus', 'discipline', 'vitality', 'creativity'];
  const xp = Number(req.body.xp_reward || 25), gold = Number(req.body.gold_reward || 10);
  if (!title || !allowed.includes(attribute) || !Number.isInteger(xp) || xp < 5 || xp > 500 || !Number.isInteger(gold) || gold < 1 || gold > 250) return res.status(400).json({ error: 'Invalid quest details.' });
  const task = { id: id(), user_id: req.userId, title, description: String(req.body.description || '').slice(0, 500), attribute, xp_reward: xp, gold_reward: gold, frequency: ['daily','weekly','once'].includes(req.body.frequency) ? req.body.frequency : 'daily', due_date: req.body.due_date || null };
  db.prepare('INSERT INTO tasks (id,user_id,title,description,attribute,xp_reward,gold_reward,frequency,due_date) VALUES (@id,@user_id,@title,@description,@attribute,@xp_reward,@gold_reward,@frequency,@due_date)').run(task);
  res.status(201).json(safeTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)));
});
app.patch('/api/tasks/:id', authenticate, (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Quest not found.' });
  if (existing.completed_at) return res.status(409).json({ error: 'Completed quests cannot be edited.' });
  const title = req.body.title === undefined ? existing.title : String(req.body.title).trim().slice(0, 120);
  const description = req.body.description === undefined ? existing.description : String(req.body.description).slice(0, 500);
  if (!title) return res.status(400).json({ error: 'Quest title is required.' });
  db.prepare('UPDATE tasks SET title = ?, description = ?, due_date = ? WHERE id = ? AND user_id = ?').run(title, description, req.body.due_date === undefined ? existing.due_date : req.body.due_date, existing.id, req.userId);
  res.json(safeTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id)));
});
app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? AND completed_at IS NULL').run(req.params.id, req.userId);
  if (!result.changes) return res.status(404).json({ error: 'Active quest not found.' });
  res.status(204).end();
});
app.post('/api/tasks/:id/complete', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Quest not found.' });
  if (task.completed_at) return res.status(409).json({ error: 'This quest was already completed.' });
  const today = new Date().toISOString().slice(0, 10);
  const hero = character(req.userId), previousLevel = hero.level;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = hero.last_completed_on === today ? hero.current_streak : hero.last_completed_on === yesterday ? hero.current_streak + 1 : 1;
  const nextXp = hero.xp + task.xp_reward, level = levelFor(nextXp);
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(task.id, req.userId);
    db.prepare(`UPDATE characters SET xp=?, gold=gold+?, ${task.attribute}=${task.attribute}+1, level=?, current_streak=?, longest_streak=MAX(longest_streak, ?), last_completed_on=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(nextXp, task.gold_reward, level, streak, streak, today, req.userId);
    log(req.userId, 'quest_complete', `Completed: ${task.title}`, task.xp_reward, task.gold_reward);
    if (level > previousLevel) log(req.userId, 'level_up', `Ascended to level ${level}!`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ task: safeTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)), character: character(req.userId), levelUp: level > previousLevel, xpToNext: xpForNext(level) });
});

app.get('/api/activity', authenticate, (req, res) => res.json(db.prepare('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.userId)));
app.get('/api/notifications', authenticate, (req, res) => {
  const rows = db.prepare('SELECT id,type,message,created_at FROM activity_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 5').all(req.userId);
  res.json({ notifications: rows.map(row => ({ ...row, title: row.type === 'quest_complete' ? 'Quest completed' : row.type === 'level_up' ? 'Level ascension' : row.type === 'purchase' ? 'Vault transaction' : 'Realm update' })) });
});
app.get('/api/export.json', authenticate, (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="abhyudaya-export.json"');
  res.json({ exported_at: new Date().toISOString(), character: character(req.userId), tasks: db.prepare('SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC').all(req.userId).map(safeTask), activity: db.prepare('SELECT * FROM activity_logs WHERE user_id=? ORDER BY created_at DESC').all(req.userId), inventory: db.prepare('SELECT s.* FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=?').all(req.userId) });
});
app.get('/api/export.csv', authenticate, (req, res) => {
  const rows = db.prepare('SELECT created_at,type,message,xp_delta,gold_delta FROM activity_logs WHERE user_id=? ORDER BY created_at DESC').all(req.userId);
  const q = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="abhyudaya-activity.csv"').send(['timestamp,type,message,xp_delta,gold_delta', ...rows.map(row => [row.created_at,row.type,row.message,row.xp_delta,row.gold_delta].map(q).join(','))].join('\n'));
});
app.get('/api/shop', authenticate, (req, res) => res.json(db.prepare('SELECT s.*, i.item_id IS NOT NULL AS owned FROM shop_items s LEFT JOIN inventory i ON i.item_id=s.id AND i.user_id=? ORDER BY price').all(req.userId)));
app.post('/api/shop/:id/purchase', authenticate, (req, res) => {
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (db.prepare('SELECT 1 FROM inventory WHERE user_id=? AND item_id=?').get(req.userId, item.id)) return res.status(409).json({ error: 'You already own this item.' });
  const hero = character(req.userId);
  if (hero.gold < item.price) return res.status(409).json({ error: 'Not enough gold.' });
  db.exec('BEGIN');
  try { db.prepare('UPDATE characters SET gold=gold-? WHERE user_id=?').run(item.price, req.userId); db.prepare('INSERT INTO inventory (user_id,item_id) VALUES (?,?)').run(req.userId,item.id); log(req.userId, 'purchase', `Purchased: ${item.name}`, 0, -item.price); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
  res.status(201).json({ item, character: character(req.userId) });
});
app.get('/api/inventory', authenticate, (req, res) => res.json(db.prepare('SELECT s.*, i.purchased_at, i.equipped, i.quantity FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=? ORDER BY i.equipped DESC, i.purchased_at DESC').all(req.userId)));
app.post('/api/inventory/:id/equip', authenticate, (req, res) => {
  const item = db.prepare('SELECT s.* FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=? AND i.item_id=?').get(req.userId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item is not in your inventory.' });
  if (!['relic','badge','theme','aura'].includes(item.category)) return res.status(409).json({ error: 'Only gear, badges, themes, and auras can be equipped.' });
  db.exec('BEGIN');
  try { db.prepare('UPDATE inventory SET equipped=0 WHERE user_id=? AND item_id IN (SELECT id FROM shop_items WHERE category=?)').run(req.userId,item.category); db.prepare('UPDATE inventory SET equipped=1 WHERE user_id=? AND item_id=?').run(req.userId,item.id); log(req.userId,'inventory',`Equipped: ${item.name}.`); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ item, inventory: db.prepare('SELECT s.*,i.equipped FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=?').all(req.userId) });
});
app.post('/api/inventory/:id/use', authenticate, (req, res) => {
  const item = db.prepare('SELECT s.* FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=? AND i.item_id=?').get(req.userId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item is not in your inventory.' });
  if (!['consumable','booster'].includes(item.category)) return res.status(409).json({ error: 'This item cannot be used.' });
  db.exec('BEGIN');
  try { db.prepare('DELETE FROM inventory WHERE user_id=? AND item_id=?').run(req.userId,item.id); log(req.userId,'inventory',`Used: ${item.name}.`); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ item, inventory: db.prepare('SELECT s.*,i.equipped FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=?').all(req.userId) });
});
app.post('/api/inventory/:id/disenchant', authenticate, (req, res) => {
  const item = db.prepare('SELECT s.* FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=? AND i.item_id=?').get(req.userId, req.params.id);
  if (!item || item.price === 0) return res.status(404).json({ error: 'Item cannot be disenchanted.' });
  const value = Math.max(1, Math.floor(item.price * .4));
  db.exec('BEGIN');
  try { db.prepare('DELETE FROM inventory WHERE user_id=? AND item_id=?').run(req.userId,item.id); db.prepare('UPDATE characters SET gold=gold+? WHERE user_id=?').run(value,req.userId); log(req.userId,'inventory',`Disenchanted: ${item.name}.`,0,value); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ item, gold:value, character:character(req.userId) });
});
app.post('/api/ascensions/claim', authenticate, (req, res) => {
  const hero = character(req.userId);
  if (hero.level < 2) return res.status(409).json({ error: 'Reach level 2 before claiming an ascension reward.' });
  const allocation = req.body.allocation && typeof req.body.allocation === 'object' ? req.body.allocation : {};
  const stats = ['intellect', 'focus', 'discipline'];
  const values = Object.fromEntries(stats.map(stat => [stat, Number(allocation[stat] || 0)]));
  if (!Object.values(values).every(Number.isInteger) || Object.values(values).some(value => value < 0) || Object.values(values).reduce((sum, value) => sum + value, 0) !== 3) return res.status(400).json({ error: 'Allocate all 3 ascension points before claiming.' });
  if (db.prepare('SELECT 1 FROM ascension_claims WHERE user_id=? AND level=?').get(req.userId, hero.level)) return res.status(409).json({ error: `Level ${hero.level} ascension rewards were already claimed.` });
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO ascension_claims (user_id,level) VALUES (?,?)').run(req.userId, hero.level);
    db.prepare('UPDATE characters SET gold=gold+250, intellect=intellect+?, focus=focus+?, discipline=discipline+?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(values.intellect, values.focus, values.discipline, req.userId);
    db.prepare('INSERT OR IGNORE INTO inventory (user_id,item_id) VALUES (?,?)').run(req.userId, 'ascension-cache');
    log(req.userId, 'ascension', `Claimed level ${hero.level} ascension cache.`, 0, 250);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.status(201).json({ character: character(req.userId), level: hero.level, allocation: values });
});

app.use(express.static(__dirname, { index: 'index.html' }));
app.use((error, req, res, next) => {
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request data.' });
  console.error(error);
  res.status(500).json({ error: 'The realm encountered an unexpected error.' });
});
app.listen(port, () => console.log(`Abhyudaya is running at http://localhost:${port}`));
