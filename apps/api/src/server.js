import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbFile = path.join(dataDir, "db.json");
const downloadsDir = path.join(__dirname, "..", "downloads");

const defaultConfig = {
  autoBan: true,
  evidenceBeforeBan: true,
  webhookEnabled: false,
  webhookUrl: "",
  mode: "strict",
  detectionConfidence: 70,
  screenshotEveryMs: 30000,
  streamEveryMs: 5000,
  detections: {
    // weapon manager
    weapon_spawn:true, blacklisted_weapon:true, infinite_ammo:true, no_reload:true, rapid_fire:true,
    damage_multiplier:true, spoofed_damage_multiplier:true, magic_bullet:true, silent_aim:true,
    aimbot:true, triggerbot:true, no_recoil:true, no_spread:true, thick_bullet:true, piercing:true,
    explosive_ammo:true, incendiary_ammo:true,

    // player
    godmode:true, semi_god:true, anti_headshot:true, anti_ragdoll:true, no_collision:true,
    super_jump:true, beast_jump:true, fast_run:true, swim_speed:true, infinite_stamina:true,
    noclip:true, fly_mode:true, invisibility:true, freecam:true, spectate_player:true,
    thermal_vision:true, night_vision:true, teleport:true, lag_switch:true, force_desync:true,

    // vehicle
    vehicle_spawner:true, vehicle_boost:true, vehicle_godmode:true, max_vehicle:true,
    auto_repair:true, bulletproof_tires:true, vehicle_jump:true, plate_change:true,
    vehicle_color_abuse:true, engine_force:true,

    // server abuse
    object_spawner:true, ped_spawner:true, explosions:true, projectile_abuse:true,
    particle_fx_abuse:true, trigger_spam:true, resource_stop:true, executor_injection:true,
    fake_chat:true, cage_player:true, money_drop:true, weather_time_abuse:true
  },
  punishments: {
    noclip:"ban", teleport:"ban", godmode:"ban", weapon_spawn:"ban", blacklisted_weapon:"ban",
    vehicle_spawner:"ban", object_spawner:"ban", explosions:"ban", executor_injection:"ban",
    aimbot:"ban", silent_aim:"ban", magic_bullet:"ban", rapid_fire:"ban", freecam:"ban",
    invisibility:"ban", vehicle_boost:"ban", infinite_ammo:"ban"
  },
  resourceWhitelist: [],
  eventWhitelist: [],
  playerWhitelist: []
};

const emptyDb = {
  servers: [{ id:"main", name:"ATHENA PVP", ip:"not connected", status:"offline", slots:0, players:0, lastSeen:null, cpu:0, ram:0 }],
  players: [],
  detections: [],
  bans: [],
  whitelist: [],
  admins: [],
  logs: [],
  actions: [],
  resources: [],
  streams: [],
  screenshots: [],
  sessions: [],
  hwid: [],
  risk: [],
  configHistory: [],
  config: defaultConfig
};

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
}
function loadDb() {
  ensureDir();
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(emptyDb, null, 2));
  const db = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  let changed = false;
  for (const [k, v] of Object.entries(emptyDb)) {
    if (db[k] === undefined) { db[k] = v; changed = true; }
  }
  if (!db.config || !db.config.detections) { db.config = defaultConfig; changed = true; }
  for (const [k, v] of Object.entries(defaultConfig)) {
    if (db.config[k] === undefined) { db.config[k] = v; changed = true; }
  }
  for (const [k, v] of Object.entries(defaultConfig.detections)) {
    if (db.config.detections[k] === undefined) { db.config.detections[k] = v; changed = true; }
  }
  if (changed) saveDb(db);
  return db;
}
function saveDb(db) { ensureDir(); fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }
function mutate(fn) { const db = loadDb(); const out = fn(db); saveDb(db); return out; }
const now = () => Date.now();
const makeId = () => uuid();
const makeBanId = () => `ATH-${Math.floor(100000 + Math.random() * 899999)}`;
const makeEvidence = (txt="DETECTION") => `https://placehold.co/1280x720/040b16/16d8ff?text=ATHENA+EVIDENCE+${encodeURIComponent(txt)}`;

function sign(user) { return jwt.sign(user, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" }); }
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || "dev_secret"); next(); }
  catch { return res.status(401).json({ error: "Invalid token" }); }
}
function bridge(req, res, next) {
  if (req.headers["x-athena-key"] !== (process.env.ATHENA_API_KEY || "athena_secret")) {
    return res.status(401).json({ error: "Bad bridge key" });
  }
  next();
}

function log(type, payload = {}, by = "system") {
  const item = { id: makeId(), type, payload, by, createdAt: now() };
  mutate(db => { db.logs.push(item); db.logs = db.logs.slice(-3000); });
  io.emit("log:new", item);
  return item;
}

function isWhitelisted(db, identifiers = []) {
  const joined = JSON.stringify(identifiers || []);
  return (db.whitelist || []).some(w => w.active !== false && (joined.includes(w.value) || identifiers.includes(w.value)));
}

function stats(db) {
  const online = db.players.filter(p => p.online).length;
  const det24 = db.detections.filter(d => d.createdAt > now() - 86400000).length;
  const activeBans = db.bans.filter(b => b.active).length;
  const identifiers = new Set(db.players.flatMap(p => p.identifiers || [])).size;
  const s = db.servers[0] || {};
  return {
    onlineNow: online,
    totalPlayers: identifiers || db.players.length,
    activeBans,
    totalBans: activeBans,
    detections24: det24,
    totalDetections: db.detections.length,
    resources: db.resources.length,
    streams: db.streams.length,
    screenshots: db.screenshots.length,
    admins: db.admins.length,
    whitelist: db.whitelist.length,
    serverPlayers: s.players || online,
    serverSlots: s.slots || 0,
    cpu: s.cpu || 0,
    ram: s.ram || 0,
    lastSeen: s.lastSeen
  };
}

function riskForPlayer(db, p) {
  const det = db.detections.filter(x => String(x.playerId || x.source) === String(p.id));
  const ban = db.bans.some(b => (b.identifiers || []).some(id => (p.identifiers || []).includes(id)));
  const high = det.filter(x => ["noclip","godmode","weapon_spawn","executor_injection","aimbot","silent_aim"].includes(x.reason)).length;
  return Math.min(100, det.length * 13 + high * 17 + (p.ping > 180 ? 8 : 0) + (ban ? 35 : 0));
}

async function sendWebhook(db, title, message) {
  if (!db.config.webhookEnabled || !db.config.webhookUrl) return;
  try {
    await fetch(db.config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username:"ATHENA SHIELD", embeds:[{ title, description:message, color:1552639 }] })
    });
  } catch {}
}

function seed() {
  const db = loadDb();
  if (!db.admins.length) {
    db.admins.push({
      id:"owner",
      name:"Owner",
      email:process.env.ADMIN_EMAIL || "admin@athena.local",
      passwordHash:bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10),
      role:"owner",
      permissions:["*"],
      active:true,
      createdAt:now(),
      lastActivity:null
    });
    saveDb(db);
  }
  console.log("[ATHENA] Login:", process.env.ADMIN_EMAIL || "admin@athena.local", process.env.ADMIN_PASSWORD || "admin123");
}
seed();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors:{ origin: process.env.PANEL_ORIGIN || "*" } });
app.use(cors({ origin: process.env.PANEL_ORIGIN || "*" }));
app.use(express.json({ limit:"40mb" }));
app.use(morgan("dev"));
io.on("connection", s => s.emit("hello", { app:"ATHENA FINAL" }));

app.get("/health", (_, res) => res.json({ ok:true }));
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const db = loadDb();
  const admin = db.admins.find(a => a.email === email && a.active !== false);
  if (!admin || !bcrypt.compareSync(password || "", admin.passwordHash)) return res.status(401).json({ error:"Invalid login" });
  mutate(d => { const a = d.admins.find(x => x.id === admin.id); if (a) a.lastActivity = now(); });
  log("admin.login", { email }, email);
  res.json({ token: sign({ id:admin.id, email:admin.email, role:admin.role, permissions:admin.permissions }), user:{ id:admin.id, email:admin.email, role:admin.role } });
});

app.get("/api/dashboard", auth, (_, res) => {
  const db = loadDb();
  const risk = db.players.map(p => ({ ...p, score: riskForPlayer(db, p), flags: db.detections.filter(d => String(d.playerId) === String(p.id)).length }));
  res.json({
    server: db.servers[0], stats: stats(db), config: db.config,
    players: db.players, detections: db.detections.slice(-350).reverse(),
    bans: db.bans.slice(-350).reverse(), whitelist: db.whitelist,
    admins: db.admins.map(({passwordHash, ...a}) => a),
    logs: db.logs.slice(-350).reverse(), actions: db.actions.slice(-350).reverse(),
    resources: db.resources, streams: db.streams,
    screenshots: db.screenshots.slice(-250).reverse(),
    hwid: db.hwid, sessions: db.sessions.slice(-250).reverse(), risk
  });
});

app.get("/api/lookup", auth, (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const db = loadDb();
  const match = x => q && JSON.stringify(x || {}).toLowerCase().includes(q);
  res.json({
    query: q,
    players: db.players.filter(match).slice(0,100),
    bans: db.bans.filter(match).slice(0,100),
    detections: db.detections.filter(match).slice(0,100),
    whitelist: db.whitelist.filter(match).slice(0,100),
    admins: db.admins.map(({passwordHash, ...a}) => a).filter(match).slice(0,100),
    logs: db.logs.filter(match).slice(0,100),
    hwid: db.hwid.filter(match).slice(0,100),
    sessions: db.sessions.filter(match).slice(0,100),
    resources: db.resources.filter(match).slice(0,100)
  });
});

app.get("/api/config", auth, (_, res) => res.json(loadDb().config));
app.put("/api/config", auth, (req, res) => {
  let cfg;
  mutate(db => {
    db.configHistory.push({ id:makeId(), before:db.config, by:req.user.email, createdAt:now() });
    db.config = {
      ...db.config,
      ...req.body,
      detections: { ...db.config.detections, ...(req.body.detections || {}) },
      punishments: { ...db.config.punishments, ...(req.body.punishments || {}) }
    };
    cfg = db.config;
  });
  log("config.save", { keys:Object.keys(req.body || {}) }, req.user.email);
  io.emit("config:update", cfg);
  res.json(cfg);
});

app.post("/api/bans", auth, (req, res) => {
  let ban;
  mutate(db => {
    const screen = req.body.screen || makeEvidence(req.body.reason);
    ban = { id:makeId(), banId:makeBanId(), playerName:req.body.playerName || "Unknown", identifiers:req.body.identifiers || [], reason:req.body.reason || "Dashboard ban", screen, active:true, createdAt:now(), by:req.user.email };
    db.bans.push(ban);
  });
  log("ban.create", { banId:ban.banId, reason:ban.reason }, req.user.email);
  io.emit("ban:new", ban);
  res.json(ban);
});
app.post("/api/bans/:banId/unban", auth, (req, res) => {
  let ban;
  mutate(db => { ban = db.bans.find(b => b.banId === req.params.banId); if (ban) ban.active = false; });
  if (!ban) return res.status(404).json({ error:"Ban not found" });
  log("ban.revoke", { banId:req.params.banId }, req.user.email);
  io.emit("ban:update", ban);
  res.json(ban);
});

app.post("/api/whitelist", auth, (req, res) => {
  const item = { id:makeId(), type:req.body.type || "license", value:req.body.value, note:req.body.note || "", active:true, createdAt:now(), by:req.user.email };
  if (!item.value) return res.status(400).json({ error:"value required" });
  mutate(db => db.whitelist.push(item));
  log("whitelist.add", item, req.user.email);
  io.emit("whitelist:new", item);
  res.json(item);
});
app.delete("/api/whitelist/:id", auth, (req, res) => {
  mutate(db => db.whitelist = db.whitelist.filter(w => w.id !== req.params.id));
  log("whitelist.remove", { id:req.params.id }, req.user.email);
  res.json({ ok:true });
});

app.post("/api/admins", auth, (req, res) => {
  let a;
  mutate(db => {
    a = { id:makeId(), name:req.body.name || "Admin", email:req.body.email, passwordHash:bcrypt.hashSync(req.body.password || "123456", 10), role:req.body.role || "admin", permissions:req.body.permissions || ["dashboard:read"], discord:req.body.discord || "", active:true, createdAt:now() };
    db.admins.push(a);
  });
  const { passwordHash, ...safe } = a;
  log("admin.create", { email:safe.email }, req.user.email);
  io.emit("admin:new", safe);
  res.json(safe);
});
app.delete("/api/admins/:id", auth, (req, res) => {
  mutate(db => db.admins = db.admins.filter(a => a.id !== req.params.id));
  log("admin.delete", { id:req.params.id }, req.user.email);
  res.json({ ok:true });
});

app.post("/api/actions/player/:id/:action", auth, (req, res) => {
  const a = { id:makeId(), type:`player.${req.params.action}`, playerId:req.params.id, payload:req.body || {}, createdAt:now(), by:req.user.email, done:false };
  mutate(db => db.actions.push(a));
  log("player.action", a, req.user.email);
  io.emit("server:command", a);
  res.json(a);
});
app.post("/api/resources/:name/:action", auth, (req, res) => {
  const a = { id:makeId(), type:`resource.${req.params.action}`, resource:req.params.name, payload:req.body || {}, createdAt:now(), by:req.user.email, done:false };
  mutate(db => db.actions.push(a));
  log("resource.action", a, req.user.email);
  io.emit("server:command", a);
  res.json(a);
});
app.get("/api/actions/pending", bridge, (_, res) => res.json(loadDb().actions.filter(a => !a.done).slice(0,30)));
app.post("/api/actions/:id/done", bridge, (req, res) => {
  mutate(db => { const a = db.actions.find(x => x.id === req.params.id); if (a) { a.done = true; a.result = req.body || {}; a.doneAt = now(); } });
  res.json({ ok:true });
});

app.get("/api/streams", auth, (_, res) => res.json(loadDb().streams));
app.post("/api/streams/mock", auth, (req, res) => {
  const s = { id:makeId(), playerId:req.body.playerId || Math.floor(Math.random()*200), playerName:req.body.playerName || "Test Player", image:`https://placehold.co/1280x720/06101f/16d8ff?text=ATHENA+LIVE+${Date.now()}`, health:150, armor:80, weapon:"WEAPON_PISTOL", coords:{x:0,y:0,z:72}, updatedAt:now() };
  mutate(db => { db.streams.unshift(s); db.streams = db.streams.slice(0,24); });
  io.emit("stream:update", s);
  res.json(s);
});
app.get("/api/screenshots", auth, (_, res) => res.json(loadDb().screenshots.slice().reverse()));
app.post("/api/screenshots/mock", auth, (req, res) => {
  const shot = { id:makeId(), playerName:req.body.playerName || "Manual Test", image:makeEvidence(req.body.reason || "SCREENSHOT"), reason:req.body.reason || "Manual evidence", createdAt:now(), by:req.user.email };
  mutate(db => { db.screenshots.push(shot); db.screenshots = db.screenshots.slice(-500); });
  io.emit("screenshot:new", shot);
  res.json(shot);
});
app.get("/api/risk", auth, (_, res) => {
  const db = loadDb();
  res.json(db.players.map(p => ({ ...p, score:riskForPlayer(db,p), flags:db.detections.filter(x => String(x.playerId) === String(p.id)).length })));
});
app.get("/api/download/:type", auth, (req, res) => {
  if (req.query.code !== (process.env.DOWNLOAD_CODE || "20060331")) return res.status(403).json({ error:"Bad code" });
  const zip = new AdmZip();
  zip.addFile("README.txt", Buffer.from("ATHENA protected download. Code accepted: 20060331"));
  const fivemPath = path.join(__dirname, "..", "..", "fivem");
  if (fs.existsSync(fivemPath)) zip.addLocalFolder(fivemPath, "fivem");
  const out = path.join(downloadsDir, `athena-${req.params.type}.zip`);
  zip.writeZip(out);
  log("download", { type:req.params.type }, req.user.email);
  res.download(out);
});

// Bridge
app.post("/api/bridge/snapshot", bridge, (req, res) => {
  const body = req.body || {};
  mutate(db => {
    db.servers[0] = {
      ...(db.servers[0] || {}),
      id:body.serverId || "main", name:body.hostname || db.servers[0]?.name || "ATHENA PVP",
      ip:body.ip || db.servers[0]?.ip || "", status:"online",
      players:(body.players || []).length, slots:body.maxClients || 0,
      lastSeen:now(), cpu:body.metrics?.cpu || 0, ram:body.metrics?.ram || 0
    };
    db.players = (body.players || []).map(p => ({ ...p, online:true, updatedAt:now() }));
    db.resources = body.resources || db.resources;
    db.hwid = [...new Map(db.players.flatMap(p => (p.identifiers || []).map(identifier => [identifier, { id:identifier, playerName:p.name, lastSeen:now(), risk:0 }]))).values()];
    db.sessions.push({ id:makeId(), type:"snapshot", players:(body.players || []).length, createdAt:now() });
    db.sessions = db.sessions.slice(-700);
  });
  io.emit("snapshot:update", body);
  res.json({ ok:true });
});

app.post("/api/bridge/detection", bridge, async (req, res) => {
  const body = req.body || {};
  let detection, ban = null, screen = body.screen;
  mutate(db => {
    if (!screen && db.config.evidenceBeforeBan) screen = makeEvidence(body.reason || "DETECTION");
    const wl = isWhitelisted(db, body.identifiers || []);
    detection = {
      id:makeId(), serverId:body.serverId || "main", playerId:body.playerId || body.source,
      playerName:body.playerName || "Unknown", reason:body.reason || "unknown",
      details:body.details || "", identifiers:body.identifiers || [], coords:body.coords || null,
      weapon:body.weapon || null, screen, whitelisted:wl, confidence:body.confidence || db.config.detectionConfidence || 70, createdAt:now()
    };
    db.detections.push(detection);
    if (body.autoBan !== false && db.config.autoBan !== false && !wl) {
      ban = { id:makeId(), banId:makeBanId(), playerName:detection.playerName, identifiers:detection.identifiers, reason:`${detection.reason} | ${detection.details}`, screen:detection.screen, active:true, createdAt:now(), by:"ATHENA AUTO" };
      db.bans.push(ban);
    }
  });
  io.emit("detection:new", detection);
  if (ban) io.emit("ban:new", ban);
  await sendWebhook(loadDb(), "ATHENA Detection", `${detection.playerName} - ${detection.reason}\n${detection.details}`);
  res.json({ ok:true, detection, ban });
});

app.post("/api/bridge/stream", bridge, (req, res) => {
  const s = { id:req.body.id || makeId(), playerId:req.body.playerId || req.body.source, playerName:req.body.playerName || "Unknown", image:req.body.image, health:req.body.health, armor:req.body.armor, weapon:req.body.weapon, coords:req.body.coords, updatedAt:now() };
  mutate(db => { const i = db.streams.findIndex(x => String(x.playerId) === String(s.playerId)); if (i >= 0) db.streams[i] = s; else db.streams.unshift(s); db.streams = db.streams.slice(0,24); });
  io.emit("stream:update", s);
  res.json({ ok:true });
});
app.get("/api/bridge/config", bridge, (_, res) => res.json(loadDb().config));
app.get("/api/bridge/bans", bridge, (_, res) => res.json(loadDb().bans.filter(b => b.active)));

app.post("/api/upload/screenshot", express.raw({ type: "*/*", limit: "20mb" }), (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "..", "downloads", "screenshots");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `screen-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, req.body);

    res.json({
      success: true,
      url: `${process.env.PUBLIC_API_URL || "http://127.0.0.1:4010"}/screenshots/${filename}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/screenshots", express.static(path.join(__dirname, "..", "downloads", "screenshots")));

app.post("/api/bridge/screenshot", bridge, (req, res) => {
  const shot = {
    id: makeId ? makeId() : String(Date.now()),
    playerId: req.body.playerId,
    playerName: req.body.playerName || "Unknown",
    image: req.body.image,
    reason: req.body.reason || "Dashboard screenshot",
    createdAt: Date.now(),
    by: "ATHENA WEBBRIDGE"
  };

  mutate(db => {
    db.screenshots = db.screenshots || [];
    db.screenshots.push(shot);
    db.screenshots = db.screenshots.slice(-500);
  });

  io.emit("screenshot:new", shot);
  res.json({ ok: true, shot });
});

app.post("/api/bridge/online-stream-cleanup", bridge, (req, res) => {
  const onlineIds = new Set((req.body.players || []).map(p => String(p.id)));

  mutate(db => {
    db.streams = (db.streams || []).filter(s => onlineIds.has(String(s.playerId)));
  });

  io.emit("streams:cleanup", { online: [...onlineIds] });
  res.json({ ok: true });
});

app.get("/api/bridge/whitelist", bridge, (req, res) => {
  const db = loadDb();
  res.json((db.whitelist || []).filter(w => w.active !== false));
});

const port = Number(process.env.API_PORT || 4010);

server.listen(port, '0.0.0.0', () => {
  console.log(`[ATHENA FINAL API] http://0.0.0.0:${port}`);
});
