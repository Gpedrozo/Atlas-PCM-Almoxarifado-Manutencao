'use strict';
/* =========================================================
   server.js — Servidor Atlas PCM Almoxarifado
   Node.js puro (sem dependências externas)
   ========================================================= */

// ===== CARREGUE .ENV ANTES DE QUALQUER COISA =====
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
      });
      console.log('  ✅ .env carregado com sucesso');
    }
  } catch (e) { console.warn('  ⚠️  .env não encontrado (opcional)'); }
})();

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const ROOT = __dirname;
const DATA_DIR      = path.join(ROOT, process.env.DB_PATH || 'data');
const IMAGENS_DIR   = path.join(DATA_DIR, 'imagens');
const ORCAMENTOS_DIR = path.join(DATA_DIR, 'orcamentos');
const CONSERTOS_ANEXOS_DIR = path.join(DATA_DIR, 'consertos_anexos');

// ===== RATE LIMITING =====
const RATE_LIMIT_LOGIN = Number(process.env.RATE_LIMIT_LOGIN || 5);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 900000);
const rateLimitStore = new Map();

function checkRateLimit(ip, maxAttempts = RATE_LIMIT_LOGIN, windowMs = RATE_LIMIT_WINDOW_MS) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  if (record && record.resetAt < now) { rateLimitStore.delete(ip); }
  const current = rateLimitStore.get(ip);
  if (!current) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  if (current.count >= maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count++;
  return { allowed: true, remaining: maxAttempts - current.count };
}

// ===== CSRF TOKEN GENERATION & VALIDATION =====
const csrfTokenStore = new Map();
const CSRF_TOKEN_EXPIRY = 3600000; // 1 hora

function generateCSRFToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokenStore.set(token, { userId, createdAt: Date.now(), expiresAt: Date.now() + CSRF_TOKEN_EXPIRY });
  return token;
}

function validateCSRFToken(token, userId) {
  if (!token) return false;
  const record = csrfTokenStore.get(token);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    csrfTokenStore.delete(token);
    return false;
  }
  if (record.userId !== userId) return false;
  csrfTokenStore.delete(token); // One-time use
  return true;
}

// Limpar tokens expirados a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [token, record] of csrfTokenStore.entries()) {
    if (record.expiresAt < now) csrfTokenStore.delete(token);
  }
}, 600000);

// ===== SECURITY HEADERS =====
function setSecurityHeaders(res) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(), camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com;");
}

// Garante pastas de dados
if (!fs.existsSync(DATA_DIR))        fs.mkdirSync(DATA_DIR,        { recursive: true });
if (!fs.existsSync(IMAGENS_DIR))     fs.mkdirSync(IMAGENS_DIR,     { recursive: true });
if (!fs.existsSync(ORCAMENTOS_DIR))  fs.mkdirSync(ORCAMENTOS_DIR,  { recursive: true });
if (!fs.existsSync(CONSERTOS_ANEXOS_DIR)) fs.mkdirSync(CONSERTOS_ANEXOS_DIR, { recursive: true });

// ── Helpers de dados ──────────────────────────────────────
function _id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _now() {
  return new Date().toISOString();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function verifyPassword(password, stored) {
  const senha = String(password || '');
  const atual = String(stored || '');
  if (!atual) return { ok: false, needsRehash: false };

  if (atual.startsWith('scrypt$')) {
    const parts = atual.split('$');
    if (parts.length !== 3) return { ok: false, needsRehash: false };
    const expected = Buffer.from(parts[2], 'hex');
    const got = crypto.scryptSync(senha, parts[1], expected.length);
    let ok = false;
    try { ok = expected.length === got.length && crypto.timingSafeEqual(expected, got); } catch {}
    return { ok, needsRehash: false };
  }

  // Legacy: senhas antigas estavam em Base64. Migra no login valido.
  let legacy = '';
  try { legacy = Buffer.from(senha, 'utf8').toString('base64'); } catch {}
  return { ok: legacy === atual, needsRehash: legacy === atual };
}

function sanitizeUser(user) {
  if (!user) return null;
  const copy = Object.assign({}, user);
  delete copy.senha;
  delete copy.password;
  delete copy.passwordHash;
  return copy;
}

function sanitizeToken(token) {
  if (!token) return null;
  const copy = Object.assign({}, token);
  delete copy.token;
  delete copy.token_hash;
  return copy;
}

function readData(name) {
  const file = path.join(DATA_DIR, name + '.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeData(name, data) {
  const file = path.join(DATA_DIR, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Seed de dados iniciais ────────────────────────────────
function seed() {
  if (!readData('usuarios')) {
    const initialPassword = process.env.ATLAS_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
    writeData('usuarios', [{
      id:       'u1',
      nome:     process.env.ATLAS_ADMIN_NAME || 'Administrador',
      email:    (process.env.ATLAS_ADMIN_EMAIL || 'admin@atlas.local').toLowerCase(),
      senha:    hashPassword(initialPassword),
      nivel:    'ADMIN',
      ativo:    true,
      criadoEm: _now()
    }]);
    if (!process.env.ATLAS_ADMIN_PASSWORD) {
      console.log('  Usuario ADMIN inicial criado. Senha temporaria: ' + initialPassword);
      console.log('  Defina ATLAS_ADMIN_PASSWORD antes do primeiro start para controlar a senha inicial.');
    }
  }

  if (!readData('pecas')) {
    const now = _now();
    const pecas = [
      { id: 'p1', codigo: 'ROL-001', nome: 'Rolamento 6205 2RS',        categoria: 'Rolamentos',   unidade: 'UN', estoqueMinimo: 5,  localizacao: 'Prateleira A1', fornecedor: 'SKF',     precoUnitario: 42.50, descricao: 'Rolamento rígido de esferas diâmetro 25mm',              imagem: '', ativo: true, criadoEm: now },
      { id: 'p2', codigo: 'COR-001', nome: 'Correia em V - B50',         categoria: 'Correias',     unidade: 'UN', estoqueMinimo: 3,  localizacao: 'Prateleira B2', fornecedor: 'Gates',   precoUnitario: 78.00, descricao: 'Correia em V perfil B comprimento 50"',                 imagem: '', ativo: true, criadoEm: now },
      { id: 'p3', codigo: 'FUS-001', nome: 'Fusível 10A NH00',           categoria: 'Elétrica',     unidade: 'UN', estoqueMinimo: 10, localizacao: 'Gaveta C1',     fornecedor: 'Siemens', precoUnitario: 12.80, descricao: 'Fusível NH00 10A 500V',                                  imagem: '', ativo: true, criadoEm: now },
      { id: 'p4', codigo: 'VED-001', nome: 'Veda-calha 30mm',            categoria: 'Vedação',      unidade: 'MT', estoqueMinimo: 5,  localizacao: 'Prateleira D3', fornecedor: 'Parker',  precoUnitario:  9.50, descricao: 'Perfil de vedação borracha EPDM 30mm',                   imagem: '', ativo: true, criadoEm: now },
      { id: 'p5', codigo: 'LUB-001', nome: 'Graxa Mobilux EP2 (1kg)',    categoria: 'Lubrificantes',unidade: 'KG', estoqueMinimo: 2,  localizacao: 'Prateleira E1', fornecedor: 'Mobil',   precoUnitario: 35.00, descricao: 'Graxa de lítio com EP para mancais',                    imagem: '', ativo: true, criadoEm: now },
      { id: 'p6', codigo: 'CAB-001', nome: 'Cabo PP 3x2,5mm',            categoria: 'Elétrica',     unidade: 'MT', estoqueMinimo: 20, localizacao: 'Rolo F2',       fornecedor: 'Ficap',   precoUnitario:  8.90, descricao: 'Cabo PP flexível 3 condutores 2,5mm²',                  imagem: '', ativo: true, criadoEm: now },
      { id: 'p7', codigo: 'ROL-002', nome: 'Rolamento 6308 ZZ',          categoria: 'Rolamentos',   unidade: 'UN', estoqueMinimo: 3,  localizacao: 'Prateleira A2', fornecedor: 'SKF',     precoUnitario: 68.00, descricao: 'Rolamento rígido de esferas diâmetro 40mm',             imagem: '', ativo: true, criadoEm: now },
      { id: 'p8', codigo: 'FIL-001', nome: 'Filtro de Ar - Compressor',  categoria: 'Filtros',      unidade: 'UN', estoqueMinimo: 2,  localizacao: 'Prateleira G1', fornecedor: 'Mann',    precoUnitario: 95.00, descricao: 'Filtro de ar p/ compressor Atlas Copco GA11',           imagem: '', ativo: true, criadoEm: now },
    ];
    writeData('pecas', pecas);

    const movs = [];
    const hoje = new Date();
    pecas.forEach(function(p) {
      movs.push({ id: _id(), tipo: 'ENTRADA', pecaId: p.id, quantidade: Math.floor(Math.random()*10)+5, data: new Date(hoje - 86400000*10).toISOString(), responsavel: 'u1', ordemServico: '', observacao: 'Estoque inicial', criadoEm: now });
      movs.push({ id: _id(), tipo: 'SAIDA',   pecaId: p.id, quantidade: Math.floor(Math.random()*4)+1,  data: new Date(hoje - 86400000*3).toISOString(),  responsavel: 'u1', ordemServico: 'OS-2026-' + (Math.floor(Math.random()*899)+100), observacao: '', criadoEm: now });
    });
    writeData('movimentos', movs);
  }

  if (!readData('ativos')) {
    const now = _now();
    writeData('ativos', [
      { id: 'at1', tag: 'CMP-001', descricao: 'Compressor de Ar Atlas Copco GA11', setor: 'Utilidades', fabricante: 'Atlas Copco', modelo: 'GA11',  ativo: true, criadoEm: now },
      { id: 'at2', tag: 'TRN-001', descricao: 'Torno CNC Romi D600',               setor: 'Usinagem',   fabricante: 'Romi',        modelo: 'D600',  ativo: true, criadoEm: now },
      { id: 'at3', tag: 'FRZ-001', descricao: 'Fresadora Universal F550',           setor: 'Usinagem',   fabricante: 'Romi',        modelo: 'F550',  ativo: true, criadoEm: now },
      { id: 'at4', tag: 'CLB-001', descricao: 'Caldeira Vapor 500kg/h',             setor: 'Utilidades', fabricante: 'Intelli',     modelo: 'CV-500',ativo: true, criadoEm: now },
    ]);
  }

  if (!readData('ajustes'))          writeData('ajustes',          []);
  if (!readData('requisicoes'))      writeData('requisicoes',      []);
  if (!readData('notificacoes'))     writeData('notificacoes',     []);
  if (!readData('usuarios_retirada')) writeData('usuarios_retirada', []);
  if (!readData('consertos_solicitacoes')) writeData('consertos_solicitacoes', []);
  if (!readData('consertos_tokens')) writeData('consertos_tokens', []);
  if (!readData('consertos_anexos')) writeData('consertos_anexos', []);
  if (!readData('consertos_historico')) writeData('consertos_historico', []);
  if (!readData('consertos_tabelas_precos')) writeData('consertos_tabelas_precos', []);
  if (!readData('fornecedores'))     writeData('fornecedores',     []);
  if (!readData('materiais_consertos')) writeData('materiais_consertos', []);
  if (!readData('consertos_auditoria')) writeData('consertos_auditoria', []);
  if (!readData('config'))           writeData('config',           { proximaReqNum: 1, proximoConsertoNum: 1, proximoFornecedorNum: 1, proximoMaterialNum: 1 });
}

seed();

// ── Chave interna HMAC (gerada uma vez e persistida — garante que os links de arquivo sobrevivam a reinicializações) ─
let INTERNAL_KEY = process.env.INTERNAL_KEY || null;
(function loadOrCreateInternalKey() {
  // Se .env define INTERNAL_KEY, validar comprimento
  if (INTERNAL_KEY && INTERNAL_KEY.length === 64) {
    console.log('  INTERNAL_KEY carregada do .env');
    return;
  }
  // Caso contrário, tentar carregar de config.json (legacy)
  const cfg = readData('config') || {};
  if (cfg.internalKey && typeof cfg.internalKey === 'string' && cfg.internalKey.length === 64) {
    INTERNAL_KEY = cfg.internalKey;
    console.log('  INTERNAL_KEY carregada de config.json (MOVER PARA .ENV!)');
  } else {
    // Gerar nova se não existir
    INTERNAL_KEY = crypto.randomBytes(32).toString('hex');
    cfg.internalKey = INTERNAL_KEY;
    writeData('config', cfg);
    console.log('  INTERNAL_KEY gerada e persistida no config.json');
  }
})();

// ── Cache em memória (carregado na inicialização, evita leitura de disco a cada req) ─
const _cache = {};

function saveData(name, data) {
  _cache[name] = data;
  invalidateInitJson();
  fs.writeFile(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2), 'utf8', function(err) {
    if (err) console.error('[Servidor] Erro ao salvar ' + name + ':', err.message);
  });
}

function loadCache() {
  var all = ['pecas', 'movimentos', 'ajustes', 'requisicoes', 'usuarios', 'ativos', 'notificacoes', 'usuarios_retirada', 'consertos_solicitacoes', 'consertos_tokens', 'consertos_anexos', 'consertos_historico', 'consertos_tabelas_precos', 'fornecedores', 'materiais_consertos', 'consertos_auditoria'];
  all.forEach(function(c) { _cache[c] = readData(c) || []; });
  _cache.config = readData('config') || {};
  var total = all.reduce(function(n, c) { return n + _cache[c].length; }, 0);
  console.log('  Cache carregado: ' + total + ' registros');
}

loadCache();

// ── Cache de arquivos estáticos (serve da RAM, sem disco por requisição) ────────
const _staticCache = {};

function loadStaticCache() {
  var entries;
  try { entries = fs.readdirSync(ROOT); } catch { return; }
  var count = 0;
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(ROOT, entries[i]);
    var stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isFile()) continue;
    var ext = path.extname(entries[i]).toLowerCase();
    if (!MIME[ext]) continue;
    try {
      _staticCache[full] = {
        content: fs.readFileSync(full),
        etag:    '"' + Math.floor(stat.mtimeMs).toString(36) + stat.size.toString(36) + '"',
        mime:    MIME[ext],
        ext:     ext,
      };
      count++;
    } catch {}
  }
  console.log('  Arquivos estáticos: ' + count + ' em cache');
}

// ── JSON do /api/init pré-serializado sem imagens (evita 86MB por request) ─────
let _initJson = null;

function invalidateInitJson() { _initJson = null; }

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function publicConfig() {
  const cfg = Object.assign({}, _cache.config || {});
  return {
    empresa: cfg.empresa || '',
    logo: cfg.logo || '',
    sysUrl: cfg.sysUrl || '',
  };
}

function getInitJson(currentUser) {
  if (!_initJson) {
    const obj = {};
    obj.pecas = (_cache.pecas || []).map(function(p) {
      var copy = Object.assign({}, p);
      // Nunca enviar base64 bruto no init — apenas indicadores e filenames (pequenos)
      copy.imagem          = p.imagem ? ? true : false;
      copy.imagemExplodida = p.imagemExplodida ? ? true : false;
      copy.imagens         = p.imagens || [];
      return copy;
    });
    ['movimentos', 'ajustes', 'requisicoes', 'ativos', 'notificacoes', 'usuarios_retirada', 'consertos_solicitacoes', 'consertos_anexos', 'consertos_historico', 'consertos_tabelas_precos', 'fornecedores', 'materiais_consertos', 'consertos_auditoria'].forEach(function(c) {
      obj[c] = _cache[c] || [];
    });
    obj.usuarios = (_cache.usuarios || []).map(sanitizeUser);
    obj.consertos_tokens = (_cache.consertos_tokens || []).map(sanitizeToken);
    obj.config = _cache.config || {};
    // Remover chave interna HMAC — nunca deve ser exposta ao cliente
    if (obj.config.internalKey) {
      obj.config = Object.assign({}, obj.config);
      delete obj.config.internalKey;
    }
    _initJson = JSON.stringify(obj);
  }
  if (!currentUser) return _initJson;
  const withSession = JSON.parse(_initJson);
  withSession.usuarioAtual = sanitizeUser(currentUser);
  return JSON.stringify(withSession);
}

// ── MIME types ────────────────────────────────────────────
const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
};

loadStaticCache();

// ── DataStore — Abstração de acesso a dados ───────────────────────────────────
// Interface agnóstica de ? backend: atualmente usa o cache JSON em memória.
// Para migrar para SQLite ou PostgreSQL, substitua apenas a implementação
// dos métodos abaixo — o restante do servidor não precisa mudar.
//
// Interface pública (compatível com qualquer backend relacional):
//   DataStore.findAll(col)              → array de registros
//   DataStore.findById(col, id)         → registro ou undefined
//   DataStore.find(col, fn)             → array filtrado
//   DataStore.insert(col, obj)          → registro inserido (com id e criadoEm)
//   DataStore.update(col, id, updates)  → registro atualizado ou null
//   DataStore.upsert(col, obj)          → insert ou update por obj.id
//   DataStore.remove(col, id)           → true se removido, false se não encontrado
//   DataStore.count(col)                → total de registros
//   DataStore.getConfig()               → objeto config (sem internalKey)
//   DataStore.setConfig(updates)        → merge + persistência

const DataStore = (function() {

  // ── Implementação ? atual: JSON em memória (_cache) ──────────────────────────
  // Para trocar de backend, substitua apenas as funções abaixo.

  function findAll(col) {
    return (_cache[col] || []).slice();
  }

  function findById(col, id) {
    return (_cache[col] || []).find(function(r) { return r.id === id; });
  }

  function find(col, predicado) {
    return (_cache[col] || []).filter(predicado);
  }

  function insert(col, obj) {
    if (!_cache[col]) _cache[col] = [];
    if (!obj.id)       obj.id       = _id();
    if (!obj.criadoEm) obj.criadoEm = _now();
    _cache[col].push(obj);
    saveData(col, _cache[col]);
    return obj;
  }

  function update(col, id, updates) {
    const lista = _cache[col] || [];
    const idx   = lista.findIndex(function(r) { return r.id === id; });
    if (idx < 0) return null;
    lista[idx] = Object.assign({}, lista[idx], updates);
    saveData(col, lista);
    return lista[idx];
  }

  // Insere se não existir, atualiza se existir (usa obj.id como chave)
  function upsert(col, obj) {
    if (!_cache[col]) _cache[col] = [];
    const idx = _cache[col].findIndex(function(r) { return r.id === obj.id; });
    if (idx < 0) {
      return insert(col, obj);
    }
    _cache[col][idx] = Object.assign({}, _cache[col][idx], obj);
    saveData(col, _cache[col]);
    return _cache[col][idx];
  }

  function remove(col, id) {
    const lista = _cache[col] || [];
    const idx   = lista.findIndex(function(r) { return r.id === id; });
    if (idx < 0) return false;
    lista.splice(idx, 1);
    saveData(col, lista);
    return true;
  }

  function count(col) {
    return (_cache[col] || []).length;
  }

  function getConfig() {
    // Nunca expõe internalKey para fora do DataStore
    const cfg = Object.assign({}, _cache.config || {});
    delete cfg.internalKey;
    return cfg;
  }

  function setConfig(updates) {
    // Nunca permite sobrescrever internalKey via setConfig
    const seguro = Object.assign({}, updates);
    delete seguro.internalKey;
    _cache.config = Object.assign({}, _cache.config, seguro);
    saveData('config', _cache.config);
    return getConfig();
  }

  return { findAll, findById, find, insert, update, upsert, remove, count, getConfig, setConfig };
})();

// ── Helpers HTTP ──────────────────────────────────────────
function jsonRes(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    let body = '';
    req.on('data', function(chunk) {
      body += chunk;
      if (body.length > 20e6) { req.destroy(); reject(new Error('Payload muito grande')); }
    });
    req.on('end', function() {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

// ── Servidor ──────────────────────────────────────────────
const SESSION_COOKIE = 'atlas_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const _sessions = new Map();

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function(part) {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function sessionCookie(value, maxAgeSeconds) {
  let cookie = SESSION_COOKIE + '=' + encodeURIComponent(value || '') + '; Path=/; HttpOnly; SameSite=Strict';
  if (typeof maxAgeSeconds === 'number') cookie += '; Max-Age=' + maxAgeSeconds;
  return cookie;
}

function createSession(res, user, lembrar) {
  const sid = crypto.randomBytes(32).toString('base64url');
  const ttl = lembrar ? ? SESSION_REMEMBER_TTL_MS : SESSION_TTL_MS;
  _sessions.set(sid, { userId: user.id, expiresAt: Date.now() + ttl });
  res.setHeader('Set-Cookie', sessionCookie(sid, Math.floor(ttl / 1000)));
  return sid;
}

function destroySession(req, res) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (sid) _sessions.delete(sid);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
}

function getCurrentUser(req) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (!sid) return null;
  const sess = _sessions.get(sid);
  if (!sess || sess.expiresAt < Date.now()) {
    if (sess) _sessions.delete(sid);
    return null;
  }
  const user = (_cache.usuarios || []).find(function(u) { return u.id === sess.userId && u.ativo !== false; });
  return user || null;
}

function isAdmin(user) {
  return !!user && String(user.nivel || '').toUpperCase() === 'ADMIN';
}

function isPCM(user) {
  const nivel = String((user && user.nivel) || '').toUpperCase();
  return nivel === 'ADMIN' || nivel === 'PCM';
}

function denyAuth(res) {
  jsonRes(res, 401, { error: 'Autenticacao obrigatoria.' });
  return false;
}

function denyForbidden(res) {
  jsonRes(res, 403, { error: 'Permissao insuficiente.' });
  return false;
}

function saldoPeca(pecaId) {
  return (_cache.movimentos || [])
    .filter(function(m) { return m.pecaId === pecaId; })
    .reduce(function(acc, m) {
      const qtd = Number(m.quantidade || 0);
      if (m.tipo === 'ENTRADA' || m.tipo === 'AJUSTE_ADD') return acc + qtd;
      if (m.tipo === 'SAIDA' || m.tipo === 'AJUSTE_SUB') return acc - qtd;
      if (m.tipo === 'AJUSTE') return acc + qtd;
      return acc;
    }, 0);
}

function validateMovement(mov) {
  if (!mov || typeof mov !== 'object') return 'Movimento invalido.';
  if (!mov.pecaId) return 'pecaId obrigatorio.';
  const peca = (_cache.pecas || []).find(function(p) { return p.id === mov.pecaId; });
  if (!peca || peca.ativo === false) return 'Peca inexistente ou inativa.';
  const qtd = Number(mov.quantidade);
  if (!(qtd > 0)) return 'Quantidade deve ser maior que zero.';
  if (['SAIDA', 'AJUSTE_SUB'].includes(mov.tipo) && qtd > saldoPeca(mov.pecaId)) {
    return 'Saldo insuficiente para registrar a movimentacao.';
  }
  return '';
}

function sanitizeRecordForResponse(col, record) {
  if (Array.isArray(record)) return record.map(function(x) { return sanitizeRecordForResponse(col, x); });
  if (col === 'usuarios') return sanitizeUser(record);
  if (col === 'consertos_tokens') return sanitizeToken(record);
  return record;
}

function prepareUserForWrite(body, existing) {
  const out = Object.assign({}, body);
  if (out.email) out.email = String(out.email).trim().toLowerCase();
  if (out.senha) out.senha = hashPassword(out.senha);
  else if (existing && existing.senha) out.senha = existing.senha;
  return out;
}

function canWriteCollection(user, col, method) {
  if (!user) return false;
  if (['usuarios', 'usuarios_retirada'].includes(col)) return isAdmin(user);
  if (method === 'DELETE' && ['movimentos', 'ajustes', 'requisicoes'].includes(col)) return isAdmin(user);
  return true;
}

function safeConfigUpdate(user, body) {
  if (isAdmin(user)) return body;
  const allowed = ['proximaReqNum', 'proximoConsertoNum', 'proximoFornecedorNum', 'proximoMaterialNum',
    'reqSugestoesFornecedor', 'reqSugestoesCentroCusto', 'reqSugestoesMaterial', 'reqSugestoesEquipamento'];
  const keys = Object.keys(body || {});
  if (!keys.every(function(k) { return allowed.includes(k); })) return null;
  return body;
}

function publicConserto(sol) {
  if (!sol) return null;
  const allowed = ['id', 'numeroSolicitacao', 'codigo_material_sap', 'descricao_material_sap', 'descricao_interna',
    'valor_material', 'quantidade', 'fornecedor_codigo_sap', 'fornecedor_razao_social', 'fornecedor_cnpj',
    'fornecedor_email', 'data_prevista_retorno', 'observacoes_manutencao', 'solicitanteId', 'nf_retorno'];
  const out = {};
  allowed.forEach(function(k) { if (sol[k] !== undefined) out[k] = sol[k]; });
  return out;
}

// ── BUG #9: Registrar alerta quando link expira ──────────────────────────
function registrarAlertaLinkExpirado(solicitacao, motivo) {
  if (!solicitacao || !solicitacao.id) return;
  
  // Registrar no histórico
  if (!_cache.consertos_historico) _cache.consertos_historico = [];
  _cache.consertos_historico.push({
    id: _id(),
    solicitacaoId: solicitacao.id,
    acao: 'ALERTA_LINK_EXPIRADO',
    detalhes: 'Link expirado: ' + motivo + '. Novo link pode ser gerado em consertos.html.',
    dataHora: _now(),
    ip: 'server'
  });
  saveData('consertos_historico', _cache.consertos_historico);
  
  // Registrar notificação para supervisão
  if (!_cache.notificacoes) _cache.notificacoes = [];
  _cache.notificacoes.push({
    id: _id(),
    userId: solicitacao.supervisorId || 'supervisor',
    tipo: 'LINK_EXPIRADO',
    titulo: '⏰ Link expirou - ' + (solicitacao.numeroSolicitacao || solicitacao.id),
    mensagem: 'O link seguro para anexação de NF expirou. ' + motivo + '. Acesse consertos.html para gerar novo link.',
    referenciaId: solicitacao.id,
    referenciaTipo: 'conserto',
    lida: false,
    criadoEm: _now()
  });
  saveData('notificacoes', _cache.notificacoes);
}

function bufferFromBase64(base64) {
  const m = String(base64 || '').match(/^data:[^;]+;base64,(.+)$/s);
  return Buffer.from(m ? m[1] : String(base64 || ''), 'base64');
}

function hasMagic(ext, buffer) {
  const hex4 = buffer.slice(0, 4).toString('hex');
  if (ext === '.pdf') return hex4 === '25504446';
  if (['.jpg', '.jpeg'].includes(ext)) return buffer.slice(0, 3).toString('hex') === 'ffd8ff';
  if (ext === '.png') return buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (ext === '.gif') return buffer.slice(0, 3).toString('utf8') === 'GIF';
  if (ext === '.webp') return buffer.slice(0, 4).toString('utf8') === 'RIFF' && buffer.slice(8, 12).toString('utf8') === 'WEBP';
  if (ext === '.xml') return buffer.slice(0, 128).toString('utf8').trimStart().startsWith('<');
  if (['.docx', '.xlsx'].includes(ext)) return hex4 === '504b0304';
  if (['.doc', '.xls'].includes(ext)) return buffer.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1';
  return false;
}

const COLLECTIONS = ['pecas', 'movimentos', 'ajustes', 'requisicoes', 'usuarios', 'ativos', 'notificacoes', 'usuarios_retirada', 'consertos_solicitacoes', 'consertos_tokens', 'consertos_anexos', 'consertos_historico', 'consertos_tabelas_precos', 'fornecedores', 'materiais_consertos', 'consertos_auditoria'];

// ===== HTTPS SETUP (FASE 1) =====
let sslOptions = null;
if (USE_HTTPS) {
  try {
    const certPath = process.env.HTTPS_CERT_PATH || path.join(__dirname, 'server.crt');
    const keyPath = process.env.HTTPS_KEY_PATH || path.join(__dirname, 'server.key');
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      sslOptions = {
        cert: fs.readFileSync(certPath, 'utf8'),
        key: fs.readFileSync(keyPath, 'utf8')
      };
      console.log('  ✅ HTTPS habilitado com certificado custom');
    } else {
      console.warn('  ⚠️  Certificados não encontrados. Executar: npm run generate-cert');
      process.exit(1);
    }
  } catch (err) {
    console.error('  ❌ Erro ao carregar certificados HTTPS:', err.message);
    process.exit(1);
  }
}

const server = (USE_HTTPS  https.createServer(sslOptions, asyncHandler) : http.createServer(asyncHandler));

// ===== REQUEST HANDLER =====
async function asyncHandler(req, res) {
  // ===== ADICIONAR SECURITY HEADERS =====
  setSecurityHeaders(res);
  
  const method = req.method.toUpperCase();

  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch { pathname = req.url.split('')[0]; }

  // Restringe CORS ao próprio host (localhost / intranet) — não expõe a API para origens externas
  const origin = req.headers['origin'] || '';
  const host   = req.headers['host'] || '';
  const allowedOrigin = origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://' + host.split(':')[0])) ? origin : '';
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  // Headers de segurança HTTP
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ── API ──────────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
      const parts = pathname.slice(5).split('/').filter(Boolean);
      const col   = parts[0];
      const id    = parts[1];
      const currentUser = getCurrentUser(req);

      // POST /api/login
      if (col === 'login' && method === 'POST') {
        // ===== RATE LIMITING =====
        const clientIP = ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim();
        const limitCheck = checkRateLimit(clientIP);
        
        if (!limitCheck.allowed) {
          res.setHeader('Retry-After', limitCheck.retryAfter);
          return jsonRes(res, 429, { 
            error: 'Muitas tentativas de login. Tente novamente em ' + limitCheck.retryAfter + ' segundos.',
            retryAfter: limitCheck.retryAfter
          });
        }
        
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const senha = String(body.senha || '');
        
        // ===== VALIDAÇÃO DE EMAIL =====
        if (!email || !/^.+@.+\..+$/.test(email)) {
          return jsonRes(res, 400, { error: 'Email inválido.' });
        }
        
        const userIdx = (_cache.usuarios || []).findIndex(function(u) { return String(u.email || '').toLowerCase() === email; });
        if (userIdx < 0) return jsonRes(res, 401, { error: 'Usuario ou senha invalidos.' });
        const user = _cache.usuarios[userIdx];
        if (user.ativo === false) return jsonRes(res, 403, { error: 'Usuario inativo.' });
        const check = verifyPassword(senha, user.senha);
        if (!check.ok) return jsonRes(res, 401, { error: 'Usuario ou senha invalidos.' });
        if (check.needsRehash) {
          _cache.usuarios[userIdx] = Object.assign({}, user, { senha: hashPassword(senha), senhaMigradaEm: _now() });
          saveData('usuarios', _cache.usuarios);
        }
        const logged = _cache.usuarios[userIdx];
        logged.ultimoLoginEm = _now();
        logged.ultimoLoginIP = clientIP;
        saveData('usuarios', _cache.usuarios);
        createSession(res, logged, !!body.lembrar);
        return jsonRes(res, 200, { ok: true, usuario: sanitizeUser(logged) });
      }

      // POST /api/logout
      if (col === 'logout' && method === 'POST') {
        destroySession(req, res);
        return jsonRes(res, 200, { ok: true });
      }

      // GET /api/me
      if (col === 'me' && method === 'GET') {
        if (!currentUser) return jsonRes(res, 401, { error: 'Sessao invalida.' });
        return jsonRes(res, 200, { usuario: sanitizeUser(currentUser) });
      }

      // GET /api/public-config
      if (col === 'public-config' && method === 'GET') {
        return jsonRes(res, 200, publicConfig());
      }

      // GET /api/retirada-init - dados minimos para retirada mobile/QR
      if (col === 'retirada-init' && method === 'GET') {
        const cfg = publicConfig();
        return jsonRes(res, 200, {
          pecas: (_cache.pecas || []).map(function(p) {
            const copy = Object.assign({}, p);
            copy.imagem = p.imagem ? ? true : false;
            copy.imagemExplodida = p.imagemExplodida ? ? true : false;
            return copy;
          }),
          ativos: _cache.ativos || [],
          movimentos: _cache.movimentos || [],
          usuarios_retirada: _cache.usuarios_retirada || [],
          config: cfg,
        });
      }

      // POST /api/retirada/movimentos - saida publica validada por usuario de retirada
      if (col === 'retirada' && id === 'movimentos' && method === 'POST') {
        const body = await readBody(req);
        // CSRF Token Validation
        const csrfToken = body._csrfToken;
        if (!validateCSRFToken(csrfToken, currentUser.id)) {
          return jsonRes(res, 403, { error: 'CSRF token inválido ou expirado. Recarregue a página e tente novamente.' });
        }
        const usuariosRetirada = (_cache.usuarios_retirada || []).filter(function(u) { return u.ativo !== false; });
        if (!usuariosRetirada.length) return jsonRes(res, 403, { error: 'Nenhum usuario de retirada autorizado foi configurado.' });
        const autorizado = usuariosRetirada.find(function(u) {
          return u.id === body.responsavel || String(u.nome || '').toUpperCase() === String(body.responsavelNome || '').toUpperCase();
        });
        if (!autorizado) return jsonRes(res, 403, { error: 'Usuario de retirada nao autorizado.' });
        const mov = Object.assign({}, body, {
          tipo: 'SAIDA',
          responsavel: autorizado.id,
          responsavelNome: autorizado.nome,
          origem: 'retirada-mobile',
          data: body.data || _now(),
        });
        const errMov = validateMovement(mov);
        if (errMov) return jsonRes(res, 400, { error: errMov });
        const registro = DataStore.insert('movimentos', mov);
        return jsonRes(res, 201, registro);
      }

      // POST /api/reset-dados — limpa tudo exceto usuários e configurações
      if (col === 'reset-dados' && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        if (!isAdmin(currentUser)) return denyForbidden(res);
        ['pecas', 'movimentos', 'ajustes', 'requisicoes', 'ativos'].forEach(function(c) {
          saveData(c, []);
        });
        const cfg = Object.assign({}, _cache.config, { proximaReqNum: 1 });
        saveData('config', cfg);
        return jsonRes(res, 200, { ok: true });
      }

      // POST /api/import — importa backup completo
      if (col === 'import' && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        if (!isAdmin(currentUser)) return denyForbidden(res);
        const body = await readBody(req);
        ['pecas', 'movimentos', 'ajustes', 'requisicoes', 'usuarios', 'ativos', 'notificacoes', 'usuarios_retirada'].forEach(function(c) {
          if (Array.isArray(body[c])) saveData(c, body[c]);
        });
        if (body.config && typeof body.config === 'object') {
          const cfg = Object.assign({}, body.config);
          delete cfg.internalKey;
          saveData('config', Object.assign({}, _cache.config || {}, cfg, { internalKey: INTERNAL_KEY }));
        }
        return jsonRes(res, 200, { ok: true });
      }

      // GET /api/init — tudo de uma vez sem imagens (JSON pré-serializado, instantâneo) + CSRF token
      if (col === 'init' && method === 'GET') {
        if (!currentUser) return denyAuth(res);
        const csrfToken = generateCSRFToken(currentUser.id);
        const json = getInitJson(currentUser);
        const jsonObj = JSON.parse(json);
        jsonObj._csrfToken = csrfToken;
        const jsonWithCSRF = JSON.stringify(jsonObj);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(jsonWithCSRF) });
        res.end(jsonWithCSRF);
        return;
      }

      // GET /api/consertos-token/:token — valida token server-side, conta acesso e registra IP
      if (col === 'consertos-token' && id && method === 'GET') {
        const rawToken = id;
        const tokenHash = hashToken(rawToken);
        if (!_cache.consertos_tokens) _cache.consertos_tokens = [];
        const tokenIdx = _cache.consertos_tokens.findIndex(function(x) { return x.token_hash === tokenHash; });
        if (tokenIdx === -1) return jsonRes(res, 403, { error: 'Link inválido ou expirado.' });
        const tokenItem = Object.assign({}, _cache.consertos_tokens[tokenIdx]);
        // Validações de estado (ordem importa)
        if (tokenItem.status === 'usado') {
          return jsonRes(res, 403, { error: 'Este link já foi utilizado. A NF foi anexada com sucesso anteriormente.', reason: 'usado' });
        }
        if (tokenItem.status === 'invalidado') {
          return jsonRes(res, 403, { error: 'Este link foi invalidado. Solicite um novo link ao responsável da manutenção.', reason: 'invalidado' });
        }
        if (tokenItem.status === 'expirado_temporariamente' || tokenItem.status === 'expirado') {
          return jsonRes(res, 403, { error: 'Este link expirou temporariamente. Solicite um novo acesso ao responsável da manutenção.', reason: 'expirado_temporariamente' });
        }
        if (tokenItem.expiraEm && new Date(tokenItem.expiraEm) < new Date()) {
          const solExpId = tokenItem.solicitacaoId;
          tokenItem.status = 'expirado';
          _cache.consertos_tokens[tokenIdx] = tokenItem;
          saveData('consertos_tokens', _cache.consertos_tokens);
          // Atualiza status da solicitação para 'Link expirado'
          if (!_cache.consertos_solicitacoes) _cache.consertos_solicitacoes = [];
          const solExpIdx = _cache.consertos_solicitacoes.findIndex(function(x) { return x.id === solExpId; });
          if (solExpIdx !== -1 && !['NF anexada','Liberado para envio','Enviado para conserto','Em conserto','Material retornado','Finalizado','Cancelado'].includes(_cache.consertos_solicitacoes[solExpIdx].status)) {
            _cache.consertos_solicitacoes[solExpIdx].status = 'Link expirado';
            saveData('consertos_solicitacoes', _cache.consertos_solicitacoes);
          }
          // Registra histórico
          if (!_cache.consertos_historico) _cache.consertos_historico = [];
          _cache.consertos_historico.push({ id: _id(), solicitacaoId: solExpId, acao: 'Link expirado', detalhes: 'Token expirou por tempo (24h).', dataHora: _now(), ip: ((req.headers['x-forwarded-for']||'')||req.socket.remoteAddress||'').split(',')[0].trim() });
          saveData('consertos_historico', _cache.consertos_historico);
          // BUG #9: Registrar alerta
          if (solExpIdx !== -1) {
            registrarAlertaLinkExpirado(_cache.consertos_solicitacoes[solExpIdx], 'Token expirou após 24 horas');
          }
          return jsonRes(res, 403, { error: 'Este link expirou.', reason: 'expirado' });
        }
        if (tokenItem.status !== 'ativo') {
          return jsonRes(res, 403, { error: 'Este link não está mais ativo.', reason: tokenItem.status });
        }
        if ((tokenItem.acessosRealizados || 0) >= (tokenItem.maxAcessos || 2)) {
          const solMaxId = tokenItem.solicitacaoId;
          tokenItem.status = 'expirado_temporariamente';
          _cache.consertos_tokens[tokenIdx] = tokenItem;
          saveData('consertos_tokens', _cache.consertos_tokens);
          // Atualiza status da solicitação para 'Link expirado'
          if (!_cache.consertos_solicitacoes) _cache.consertos_solicitacoes = [];
          const solMaxIdx = _cache.consertos_solicitacoes.findIndex(function(x) { return x.id === solMaxId; });
          if (solMaxIdx !== -1 && !['NF anexada','Liberado para envio','Enviado para conserto','Em conserto','Material retornado','Finalizado','Cancelado'].includes(_cache.consertos_solicitacoes[solMaxIdx].status)) {
            _cache.consertos_solicitacoes[solMaxIdx].status = 'Link expirado';
            saveData('consertos_solicitacoes', _cache.consertos_solicitacoes);
          }
          if (!_cache.consertos_historico) _cache.consertos_historico = [];
          _cache.consertos_historico.push({ id: _id(), solicitacaoId: solMaxId, acao: 'Link expirado', detalhes: 'Número máximo de acessos atingido.', dataHora: _now(), ip: ((req.headers['x-forwarded-for']||'')||req.socket.remoteAddress||'').split(',')[0].trim() });
          saveData('consertos_historico', _cache.consertos_historico);
          // BUG #9: Registrar alerta
          if (solMaxIdx !== -1) {
            registrarAlertaLinkExpirado(_cache.consertos_solicitacoes[solMaxIdx], 'Número máximo de acessos (2) atingido');
          }
          return jsonRes(res, 403, { error: 'Este link expirou temporariamente. Solicite um novo acesso ao responsável da manutenção.', reason: 'expirado_temporariamente' });
        }
        // Registrar acesso (contagem + IP + UA capturados no servidor)
        tokenItem.acessosRealizados = (tokenItem.acessosRealizados || 0) + 1;
        tokenItem.ultimoAcessoEm = _now();
        tokenItem.ip_ultimo_acesso = ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim();
        tokenItem.navegador_ultimo_acesso = req.headers['user-agent'] || '';
        _cache.consertos_tokens[tokenIdx] = tokenItem;
        saveData('consertos_tokens', _cache.consertos_tokens);
        // Atualiza status da solicitação para 'Link acessado' se ainda aguardando
        const solAcessoId = tokenItem.solicitacaoId;
        if (!_cache.consertos_solicitacoes) _cache.consertos_solicitacoes = [];
        const solAcessoIdx = _cache.consertos_solicitacoes.findIndex(function(x) { return x.id === solAcessoId; });
        if (solAcessoIdx !== -1 && ['Enviado para contabilidade','Aguardando NF','Novo link gerado','Link expirado'].includes(_cache.consertos_solicitacoes[solAcessoIdx].status)) {
          _cache.consertos_solicitacoes[solAcessoIdx].status = 'Link acessado';
          saveData('consertos_solicitacoes', _cache.consertos_solicitacoes);
        }
        // Registra histórico de acesso ao link
        if (!_cache.consertos_historico) _cache.consertos_historico = [];
        _cache.consertos_historico.push({ id: _id(), solicitacaoId: solAcessoId, acao: 'Link acessado', detalhes: 'Contabilidade acessou o link. Acesso ' + tokenItem.acessosRealizados + '/' + (tokenItem.maxAcessos || 2), dataHora: _now(), ip: tokenItem.ip_ultimo_acesso });
        saveData('consertos_historico', _cache.consertos_historico);
        const solPublica = (_cache.consertos_solicitacoes || []).find(function(x) { return x.id === tokenItem.solicitacaoId; });
        // Retorna apenas o minimo necessario; token_hash e dados sensiveis nunca sao expostos.
        return jsonRes(res, 200, { ok: true, tokenId: tokenItem.id, solicitacaoId: tokenItem.solicitacaoId, solicitacao: publicConserto(solPublica) });
      }

      // POST /api/consertos-auditoria — registra evento de auditoria com IP capturado pelo servidor
      // Garante que o IP seja real (não manipulável pelo cliente)
      if (col === 'consertos-auditoria' && !id && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        const body = await readBody(req);
        if (!body || !body.acao || !body.solicitacaoId) {
          return jsonRes(res, 400, { error: 'acao e solicitacaoId obrigatórios' });
        }
        const ip = ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim();
        const navegador = (req.headers['user-agent'] || '').slice(0, 256);
        if (!_cache.consertos_auditoria) _cache.consertos_auditoria = [];
        const entrada = {
          id:               _id(),
          solicitacaoId:    body.solicitacaoId,
          usuarioId:        body.usuarioId        || null,
          usuarioNome:      body.usuarioNome       || null,
          acao:             String(body.acao).slice(0, 120),
          detalhes:         body.detalhes          || null,
          statusAnterior:   body.statusAnterior    || null,
          statusNovo:       body.statusNovo        || null,
          ip:               ip,
          navegador:        navegador,
          dataHora:         _now(),
        };
        _cache.consertos_auditoria.push(entrada);
        saveData('consertos_auditoria', _cache.consertos_auditoria);
        return jsonRes(res, 201, { ok: true, id: entrada.id });
      }

      // POST /api/consertos-token-usar — finaliza o link após todos os ? uploads: marca token 'usado' e solicitação 'NF anexada'
      if (col === 'consertos-token-usar' && !id && method === 'POST') {
        const body = await readBody(req);
        const { token: rawToken, solicitacaoId } = body;
        if (!rawToken || !solicitacaoId) return jsonRes(res, 400, { error: 'token e solicitacaoId obrigatórios' });
        const tokenHash = hashToken(rawToken);
        if (!_cache.consertos_tokens) _cache.consertos_tokens = [];
        const tokenIdx = _cache.consertos_tokens.findIndex(function(x) { return x.token_hash === tokenHash; });
        if (tokenIdx === -1) return jsonRes(res, 403, { error: 'Token inválido.' });
        const tokenItem = _cache.consertos_tokens[tokenIdx];
        if (tokenItem.solicitacaoId !== solicitacaoId) return jsonRes(res, 403, { error: 'Token não corresponde à solicitação.' });
        if (tokenItem.status === 'usado') return jsonRes(res, 409, { error: 'Este link já foi utilizado anteriormente. A NF já foi anexada.' });
        if (tokenItem.status === 'invalidado') return jsonRes(res, 403, { error: 'Token invalidado.' });
        if (tokenItem.status !== 'ativo') return jsonRes(res, 403, { error: 'Token expirado ou indisponivel.' });
        // Marcar token como usado
        tokenItem.status = 'usado';
        tokenItem.usadoEm = _now();
        tokenItem.ip_ultimo_acesso = ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim();
        _cache.consertos_tokens[tokenIdx] = tokenItem;
        saveData('consertos_tokens', _cache.consertos_tokens);
        // MELHORIAS: Auto-advance — Status direto para 'Liberado para envio' (sem clique extra)
        if (!_cache.consertos_solicitacoes) _cache.consertos_solicitacoes = [];
        const solIdx = _cache.consertos_solicitacoes.findIndex(function(x) { return x.id === solicitacaoId; });
        if (solIdx !== -1) {
          _cache.consertos_solicitacoes[solIdx].status = 'Liberado para envio'; // Auto-libera para envio
          _cache.consertos_solicitacoes[solIdx].data_nf_anexada = _now(); // Data de anexação para audit
          if (body.observacoesContabilidade) {
            _cache.consertos_solicitacoes[solIdx].observacoes_contabilidade = String(body.observacoesContabilidade).slice(0, 2000);
          }
          // BUG #11: Registrar email da contabilidade
          if (body.emailContabilidade) {
            _cache.consertos_solicitacoes[solIdx].email_contabilidade_registrado = String(body.emailContabilidade).toLowerCase().slice(0, 254);
          }
          if (!_cache.consertos_historico) _cache.consertos_historico = [];
          // MELHORIAS: Histórico mais descritivo com auto-advance
          const detalheAuditoria = 'NF anexada. Automaticamente liberada para envio.' + (body.emailContabilidade  ' Email: ' + String(body.emailContabilidade).toLowerCase() : '') + (body.observacoesContabilidade  ' Obs: ' + String(body.observacoesContabilidade).slice(0, 300) : '');
          _cache.consertos_historico.push({
            id: _id(),
            solicitacaoId,
            acao: 'NF anexada e liberada para envio',
            detalhes: detalheAuditoria,
            dataHora: _now(),
            ip: tokenItem.ip_ultimo_acesso || (((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim()),
            emailUsuario: body.emailContabilidade  String(body.emailContabilidade).toLowerCase() : undefined
          });
          saveData('consertos_historico', _cache.consertos_historico);
          const solicitanteId = _cache.consertos_solicitacoes[solIdx].solicitanteId;
          if (solicitanteId) {
            if (!_cache.notificacoes) _cache.notificacoes = [];
            _cache.notificacoes.push({
              id: _id(),
              userId: solicitanteId,
              tipo: 'NF_ANEXADA',
              titulo: 'NF anexada',
              mensagem: 'A NF de remessa da solicitacao ' + (_cache.consertos_solicitacoes[solIdx].numeroSolicitacao || solicitacaoId) + ' foi anexada.',
              referenciaId: solicitacaoId,
              referenciaTipo: 'conserto',
              lida: false,
              criadoEm: _now()
            });
            saveData('notificacoes', _cache.notificacoes);
          }
        }
        return jsonRes(res, 200, { ok: true });
      }

      // BUG #9: POST /api/consertos-novo-link — gera novo link quando anterior expirou
      if (col === 'consertos-novo-link' && !id && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        const body = await readBody(req);
        const { solicitacaoId } = body;
        if (!solicitacaoId) return jsonRes(res, 400, { error: 'solicitacaoId obrigatório' });
        
        // Verificar se solicitação existe e está em estado válido
        if (!_cache.consertos_solicitacoes) _cache.consertos_solicitacoes = [];
        const solIdx = _cache.consertos_solicitacoes.findIndex(function(x) { return x.id === solicitacaoId; });
        if (solIdx === -1) return jsonRes(res, 404, { error: 'Solicitação não encontrada' });
        
        const solicitacao = _cache.consertos_solicitacoes[solIdx];
        
        // Validar que solicitação está esperando NF
        if (!['Link expirado', 'Aguardando NF', 'Novo link gerado'].includes(solicitacao.status)) {
          return jsonRes(res, 400, { error: 'Solicitação não está em estado válido para gerar novo link. Status atual: ' + solicitacao.status });
        }
        
        // Invalidar links antigos
        if (!_cache.consertos_tokens) _cache.consertos_tokens = [];
        _cache.consertos_tokens.forEach(function(t) {
          if (t.solicitacaoId === solicitacaoId && t.status === 'ativo') {
            t.status = 'invalidado';
          }
        });
        saveData('consertos_tokens', _cache.consertos_tokens);
        
        // Gerar novo token
        const novoToken = crypto.randomBytes(24).toString('hex') + Date.now().toString(36);
        const novoTokenHash = hashToken(novoToken);
        const novoTokenId = _id();
        const agora = new Date();
        const expiracao = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
        
        const novoTokenObj = {
          id: novoTokenId,
          solicitacaoId: solicitacaoId,
          token_hash: novoTokenHash,
          token_raw: novoToken,
          status: 'ativo',
          criadoEm: _now(),
          expiraEm: expiracao.toISOString(),
          acessosRealizados: 0,
          maxAcessos: 2,
          ip_criacao: ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim()
        };
        
        _cache.consertos_tokens.push(novoTokenObj);
        saveData('consertos_tokens', _cache.consertos_tokens);
        
        // Atualizar status da solicitação
        solicitacao.status = 'Novo link gerado';
        saveData('consertos_solicitacoes', _cache.consertos_solicitacoes);
        
        // Registrar histórico
        if (!_cache.consertos_historico) _cache.consertos_historico = [];
        _cache.consertos_historico.push({
          id: _id(),
          solicitacaoId: solicitacaoId,
          acao: 'Novo link gerado',
          detalhes: 'Um novo link seguro foi gerado para anexação de NF. Usuário: ' + (currentUser.nome || currentUser.email),
          dataHora: _now(),
          ip: ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim()
        });
        saveData('consertos_historico', _cache.consertos_historico);
        
        // Registrar notificação de novo link gerado
        if (!_cache.notificacoes) _cache.notificacoes = [];
        _cache.notificacoes.push({
          id: _id(),
          userId: 'supervisor',
          tipo: 'NOVO_LINK_GERADO',
          titulo: '🔗 Novo link gerado - ' + (solicitacao.numeroSolicitacao || solicitacaoId),
          mensagem: 'Um novo link foi gerado por ' + (currentUser.nome || currentUser.email) + ' para a solicitação.',
          referenciaId: solicitacaoId,
          referenciaTipo: 'conserto',
          lida: false,
          criadoEm: _now()
        });
        saveData('notificacoes', _cache.notificacoes);
        
        // Retornar novo link para exibição
        return jsonRes(res, 200, {
          ok: true,
          mensagem: 'Novo link seguro gerado com sucesso. Este link expira em 24 horas.',
          tokenId: novoTokenId,
          token: novoToken,
          linkPublico: '/consertos-link.htmltoken=' + novoToken,
          expiraEm: expiracao.toISOString()
        });
      }

      // GET /api/consertos-anexos/:filename — serve arquivo de anexo de conserto
      // Requer parâmetro key= com HMAC-SHA256(filename, INTERNAL_KEY) para impedir acesso anônimo
      if (col === 'consertos-anexos' && id && method === 'GET') {
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const filePath = path.join(CONSERTOS_ANEXOS_DIR, id);
        if (!filePath.startsWith(CONSERTOS_ANEXOS_DIR + path.sep)) return jsonRes(res, 403, { error: 'Acesso negado' });
        // Validar chave de acesso (HMAC) — protege contra enumeração anônima de arquivos
        const qs = new URL(req.url, 'http://localhost').searchParams;
        const reqKey = qs.get('key') || '';
        const expectedKey = crypto.createHmac('sha256', INTERNAL_KEY).update(id).digest('hex');
        let keyValid = false;
        try { keyValid = reqKey.length === expectedKey.length && crypto.timingSafeEqual(Buffer.from(reqKey, 'hex'), Buffer.from(expectedKey, 'hex')); } catch {}
        if (!keyValid) return jsonRes(res, 403, { error: 'Acesso negado ao arquivo.' });
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return jsonRes(res, 404, { error: 'Arquivo não encontrado' });
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = { '.pdf': 'application/pdf', '.xml': 'application/xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
        const mime = mimeMap[ext] || 'application/octet-stream';
        // PDF: inline (visualização no browser). Outros: forçar download para evitar execução
        const disposition = ext === '.pdf'  'inline' : 'attachment; filename="' + path.basename(filePath) + '"';
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Disposition', disposition);
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // POST /api/consertos-anexos — upload de anexo de conserto (PDF/XML) — requer token válido
      if (col === 'consertos-anexos' && !id && method === 'POST') {
        const body = await readBody(req);
        const { base64, nomeOriginal, solicitacaoId, token: rawUploadToken, hashCliente } = body;
        if (!base64 || !nomeOriginal || !solicitacaoId) return jsonRes(res, 400, { error: 'base64, nomeOriginal e solicitacaoId obrigatórios' });
        // Validar token antes de aceitar qualquer arquivo
        if (!rawUploadToken) return jsonRes(res, 403, { error: 'Token de acesso obrigatório para upload.' });
        const uploadTokenHash = hashToken(rawUploadToken);
        const uploadToken = (_cache.consertos_tokens || []).find(function(x) { return x.token_hash === uploadTokenHash; });
        if (!uploadToken || uploadToken.status !== 'ativo') {
          return jsonRes(res, 403, { error: 'Token inválido ou expirado. Solicite um novo link ao responsável.' });
        }
        if (uploadToken.solicitacaoId !== solicitacaoId) {
          return jsonRes(res, 403, { error: 'Token não corresponde a esta solicitação.' });
        }
        const ext = path.extname(nomeOriginal).toLowerCase();
        const extensoesPermitidas = ['.pdf', '.xml'];
        if (!extensoesPermitidas.includes(ext)) {
          return jsonRes(res, 400, { error: 'Tipo de arquivo não permitido. Somente PDF e XML são aceitos.' });
        }
        const m = String(base64).match(/^data:[^;]+;base64,(.+)$/s);
        const b64d = m  m[1] : String(base64);
        const buffer = Buffer.from(b64d, 'base64');
        // ── Limite de ? tamanho: 10 MB por arquivo ────────────────────
        const MAX_BYTES = 10 * 1024 * 1024;
        if (buffer.length > MAX_BYTES) {
          return jsonRes(res, 400, { error: 'Arquivo muito grande. O limite é 10 MB por arquivo.' });
        }
        // ── Validação de magic bytes (verificação do conteúdo real) ──
        // NOTA: NÃO confiamos em file.type enviado pelo cliente!
        const pdfMagic = buffer.slice(0, 4).toString('hex') === '25504446'; // %PDF
        const xmlMagic = buffer.slice(0, 5).toString('utf8').trimStart().startsWith('<xml') ||
                          buffer.slice(0, 1).toString('utf8').trimStart().startsWith('<');
        if (ext === '.pdf' && !pdfMagic) {
          return jsonRes(res, 400, { error: 'Arquivo ? inválido: o conteúdo não é um PDF válido. Verifique se o arquivo está corrompido.' });
        }
        if (ext === '.xml' && !xmlMagic) {
          return jsonRes(res, 400, { error: 'Arquivo ? inválido: o conteúdo não é um XML válido. Verifique o formato do arquivo.' });
        }
        // ── Hash SHA-256 do arquivo ──────────────────────────────────
        const hashArquivo = crypto.createHash('sha256').update(buffer).digest('hex');
        // ── Verificar se arquivo idêntico já foi enviado (evitar duplicatas) ──
        const existingAnexo = (_cache.consertos_anexos || []).find(function(a) { 
          return a.solicitacaoId === solicitacaoId && a.hashArquivo === hashArquivo;
        });
        if (existingAnexo) {
          return jsonRes(res, 409, { error: 'Este arquivo já foi enviado anteriormente para esta solicitação.' });
        }
        // Prefixo seguro sem caminho do solicitacaoId (evita path traversal via Id malicioso)
        const prefix = 'con_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
        const filename = prefix + ext;
        const filePath = path.join(CONSERTOS_ANEXOS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        const caminhoSeguro = '/api/consertos-anexos/' + encodeURIComponent(filename) + 'key=' + crypto.createHmac('sha256', INTERNAL_KEY).update(filename).digest('hex');
        const anexo = {
          id: _id(),
          solicitacaoId,
          tipoAnexo: ext === '.xml'  'XML' : 'PDF',
          nomeOriginal,
          nomeArmazenado: filename,
          caminho: caminhoSeguro,
          extensao: ext.slice(1),
          mimeType: ext === '.xml'  'application/xml' : 'application/pdf',
          tamanho: buffer.length,
          hashArquivo,
          origemUpload: 'contabilidade',
          ipOrigem: ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim(),
          enviadoEm: _now()
        };
        if (!_cache.consertos_anexos) _cache.consertos_anexos = [];
        _cache.consertos_anexos.push(anexo);
        saveData('consertos_anexos', _cache.consertos_anexos);
        return jsonRes(res, 201, {
          filename,
          nomeOriginal,
          tamanho: buffer.length,
          hashArquivo,
          uploadadoEm: _now(),
          caminho: caminhoSeguro,
          anexo
        });
      }

      // POST /api/consertos_historico — grava histórico de consertos com metadados do request
      if (col === 'consertos_historico' && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        const body = await readBody(req);
        if (!body.id) body.id = _id();
        if (!body.dataHora) body.dataHora = _now();
        // Dados que o servidor pode observar
        body.ip = req.socket && req.socket.remoteAddress  req.socket.remoteAddress : null;
        body.userAgent = req.headers['user-agent'] || null;
        body.xForwardedFor = req.headers['x-forwarded-for'] || null;
        const list = (_cache.consertos_historico || []).concat([body]);
        saveData('consertos_historico', list);
        return jsonRes(res, 201, body);
      }

      // DELETE /api/consertos-anexos/:filename — remove arquivo de anexo de conserto (requer justificativa + auditoria)
      if (col === 'consertos-anexos' && id && method === 'DELETE') {
        if (!currentUser) return denyAuth(res);
        if (!isPCM(currentUser)) return denyForbidden(res);
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const filePath = path.join(CONSERTOS_ANEXOS_DIR, id);
        if (!filePath.startsWith(CONSERTOS_ANEXOS_DIR + path.sep)) return jsonRes(res, 403, { error: 'Acesso negado' });
        const delBody = await readBody(req).catch(function() { return {}; });
        // Registrar exclusão em auditoria independentemente de o arquivo existir
        if (!_cache.consertos_historico) _cache.consertos_historico = [];
        _cache.consertos_historico.push({
          id: _id(),
          solicitacaoId: delBody.solicitacaoId || null,
          acao: 'Anexo excluído',
          detalhes: 'Arquivo: ' + id + (delBody.justificativa  ' - Motivo: ' + String(delBody.justificativa).slice(0, 200) : ' - Sem justificativa'),
          usuarioId: delBody.usuarioId || null,
          dataHora: _now(),
          ip: ((req.headers['x-forwarded-for'] || '') || req.socket.remoteAddress || '').split(',')[0].trim()
        });
        saveData('consertos_historico', _cache.consertos_historico);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return jsonRes(res, 200, { ok: true });
      }

      // GET /api/consertos-file-key/:filename — retorna a chave HMAC para download de um anexo específico
      // Permite que páginas internas autenticadas obtenham a URL completa de download sem expor INTERNAL_KEY
      if (col === 'consertos-file-key' && id && method === 'GET') {
        if (!currentUser) return denyAuth(res);
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const key = crypto.createHmac('sha256', INTERNAL_KEY).update(id).digest('hex');
        return jsonRes(res, 200, { key, caminho: '/api/consertos-anexos/' + encodeURIComponent(id) + 'key=' + key });
      }

      // GET /api/pecas/:id/imagem — backward ? compat: serve base64 ou redireciona para imagens[]
      if (col === 'pecas' && id && parts[2] === 'imagem' && method === 'GET') {
        if (!currentUser) return denyAuth(res);
        const peca = (_cache.pecas || []).find(function(x) { return x.id === id; });
        if (!peca) return jsonRes(res, 404, { error: 'Peça não encontrada' });
        const tipo = new URL(req.url, 'http://localhost').searchParams.get('tipo') || 'principal';
        const b64  = tipo === 'explodida'  (peca.imagemExplodida || '') : (peca.imagem || '');
        if (b64) return jsonRes(res, 200, { imagem: b64 });
        // Novo ? modelo: retorna primeiro filename para backward compat
        const imagens = peca.imagens || [];
        if (imagens.length > 0) return jsonRes(res, 200, { imagem: null, filename: imagens[0] });
        return jsonRes(res, 200, { imagem: null });
      }

      // GET /api/imagens/:filename — serve arquivo de imagem do disco
      if (col === 'imagens' && id && method === 'GET') {
        if (!currentUser) return denyAuth(res);
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const imgPath = path.join(IMAGENS_DIR, id);
        if (!imgPath.startsWith(IMAGENS_DIR + path.sep)) return jsonRes(res, 403, { error: 'Acesso negado' });
        if (!fs.existsSync(imgPath) || !fs.statSync(imgPath).isFile()) return jsonRes(res, 404, { error: 'Imagem não encontrada' });
        const ext  = path.extname(id).toLowerCase();
        const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                       '.gif': 'image/gif',  '.webp': 'image/webp', '.bmp': 'image/bmp' }[ext] || 'application/octet-stream';
        const stat = fs.statSync(imgPath);
        const etag = '"' + stat.size.toString(36) + stat.mtimeMs.toString(36) + '"';
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', etag);
        if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return; }
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
        if (method !== 'HEAD') fs.createReadStream(imgPath).pipe(res);
        else res.end();
        return;
      }

      // POST /api/imagens — recebe base64, grava no disco, retorna filename
      if (col === 'imagens' && !id && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        const body = await readBody(req);
        const { base64, pecaId } = body;
        if (!base64) return jsonRes(res, 400, { error: 'base64 obrigatório' });
        // Extrai tipo e dados
        const m    = String(base64).match(/^data:image\/(\w+);base64,(.+)$/s);
        const ext  = m  (m[1] === 'jpeg' || m[1] === 'jpg'  '.jpeg' : '.' + m[1]) : '.jpeg';
        const b64d = m  m[2] : String(base64);
        const extensoesImagem = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!extensoesImagem.includes(ext)) return jsonRes(res, 400, { error: 'Tipo de imagem não permitido' });
        const buffer = Buffer.from(b64d, 'base64');
        if (buffer.length > 5 * 1024 * 1024) return jsonRes(res, 400, { error: 'Imagem muito grande. Limite: 5 MB.' });
        if (!hasMagic(ext, buffer)) return jsonRes(res, 400, { error: 'Conteúdo da imagem inválido.' });
        const prefix   = (pecaId || 'img') + '_up' + Date.now().toString(36);
        const filename = prefix + ext;
        const filePath = path.join(IMAGENS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        return jsonRes(res, 201, { filename });
      }

      // DELETE /api/imagens/:filename — remove arquivo e referências
      if (col === 'imagens' && id && method === 'DELETE') {
        if (!currentUser) return denyAuth(res);
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const imgPath = path.join(IMAGENS_DIR, id);
        if (!imgPath.startsWith(IMAGENS_DIR + path.sep)) return jsonRes(res, 403, { error: 'Acesso negado' });
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        // Remove referência do pecas
        let changed = false;
        for (const p of (_cache.pecas || [])) {
          if (Array.isArray(p.imagens)) {
            const idx = p.imagens.indexOf(id);
            if (idx >= 0) { p.imagens.splice(idx, 1); changed = true; }
          }
        }
        if (changed) { saveData('pecas', _cache.pecas); invalidateInitJson(); }
        return jsonRes(res, 200, { ok: true });
      }

      // GET /api/orcamentos/:filename — serve arquivo de orçamento
      if (col === 'orcamentos' && id && method === 'GET') {
        if (!currentUser) return denyAuth(res);
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const filePath = path.join(ORCAMENTOS_DIR, id);
        if (!filePath.startsWith(ORCAMENTOS_DIR + path.sep)) return jsonRes(res, 403, { error: 'Acesso negado' });
        if (!fs.existsSync(filePath)) return jsonRes(res, 404, { error: 'Arquivo não encontrado' });
        
        const stat = fs.statSync(filePath);
        const mime = {
          '.pdf':  'application/pdf',
          '.jpg':  'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png':  'image/png',
          '.gif':  'image/gif',
          '.doc':  'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls':  'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // POST /api/orcamentos — recebe arquivo em base64, grava no disco, retorna metadata
      if (col === 'orcamentos' && !id && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        const body = await readBody(req);
        const { base64, nomeOriginal, reqId } = body;
        if (!base64 || !nomeOriginal) return jsonRes(res, 400, { error: 'base64 e nomeOriginal obrigatórios' });
        
        // Valida extensão
        const ext = path.extname(nomeOriginal).toLowerCase();
        const extensoesPermitidas = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx'];
        if (!extensoesPermitidas.includes(ext)) {
          return jsonRes(res, 400, { error: 'Tipo de arquivo não permitido' });
        }
        
        // Extrai dados base64
        const m = String(base64).match(/^data:[^;]+;base64,(.+)$/s);
        const b64d = m  m[1] : String(base64);
        const prefix = (reqId || 'orc') + '_' + Date.now().toString(36);
        const filename = prefix + ext;
        const filePath = path.join(ORCAMENTOS_DIR, filename);
        
        const buffer = Buffer.from(b64d, 'base64');
        if (buffer.length > 10 * 1024 * 1024) {
          return jsonRes(res, 400, { error: 'Arquivo muito grande. Limite: 10 MB.' });
        }
        if (!hasMagic(ext, buffer)) {
          return jsonRes(res, 400, { error: 'Conteúdo do arquivo não confere com a extensão.' });
        }
        fs.writeFileSync(filePath, buffer);
        
        return jsonRes(res, 201, { 
          filename,
          nomeOriginal,
          tamanho: buffer.length,
          uploadadoEm: _now()
        });
      }

      // DELETE /api/orcamentos/:filename — remove arquivo
      if (col === 'orcamentos' && id && method === 'DELETE') {
        if (!currentUser) return denyAuth(res);
        if (!/^[a-zA-Z0-9_.\-]+$/.test(id)) return jsonRes(res, 400, { error: 'Nome inválido' });
        const filePath = path.join(ORCAMENTOS_DIR, id);
        if (!filePath.startsWith(ORCAMENTOS_DIR + path.sep)) return jsonRes(res, 403, { error: 'Acesso negado' });
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return jsonRes(res, 200, { ok: true });
      }

      // Config
      if (col === 'config') {
        if (!currentUser) return denyAuth(res);
        if (method === 'GET') {
          return jsonRes(res, 200, DataStore.getConfig());
        }
        if (method === 'PUT') {
          const body = await readBody(req);
          const safeBody = safeConfigUpdate(currentUser, body);
          if (!safeBody) return denyForbidden(res);
          return jsonRes(res, 200, DataStore.setConfig(safeBody));
        }
        return jsonRes(res, 405, { error: 'Método não permitido' });
      }

      // POST /api/ajustes/:id/aprovar - aplica ajuste e movimento em uma unica operacao
      if (col === 'ajustes' && id && parts[2] === 'aprovar' && method === 'POST') {
        if (!currentUser) return denyAuth(res);
        if (!isAdmin(currentUser)) return denyForbidden(res);
        let body = await readBody(req);
        // CSRF Token Validation
        const csrfToken = body._csrfToken;
        if (!validateCSRFToken(csrfToken, currentUser.id)) {
          return jsonRes(res, 403, { error: 'CSRF token inválido ou expirado. Recarregue a página e tente novamente.' });
        }
        const ajuste = DataStore.findById('ajustes', id);
        if (!ajuste) return jsonRes(res, 404, { error: 'Ajuste nao encontrado.' });
        if (ajuste.status !== 'PENDENTE') return jsonRes(res, 409, { error: 'Ajuste nao esta pendente.' });
        const tipo = ajuste.operacao === 'SUB'  'AJUSTE_SUB' : 'AJUSTE_ADD';
        const mov = {
          tipo,
          pecaId: ajuste.pecaId,
          quantidade: Number(ajuste.quantidade),
          data: _now(),
          responsavel: currentUser.id,
          observacao: 'Ajuste aprovado: ' + (ajuste.motivo || '') + ' ' + (ajuste.observacao || ''),
          ordemServico: ajuste.ordemServico || ''
        };
        const errMov = validateMovement(mov);
        if (errMov) return jsonRes(res, 400, { error: errMov });
        const movimento = DataStore.insert('movimentos', mov);
        const atualizado = DataStore.update('ajustes', id, {
          status: 'APROVADO',
          aprovadoPor: currentUser.id,
          aprovadoPorNome: currentUser.nome,
          aprovadoEm: _now(),
          movimentoId: movimento.id
        });
        return jsonRes(res, 200, { ajuste: atualizado, movimento });
      }

      if (!COLLECTIONS.includes(col)) return jsonRes(res, 404, { error: 'Coleção não encontrada' });
      if (!currentUser) return denyAuth(res);

      // ── CRUD genérico via DataStore (backend agnóstico) ──
      if (method === 'GET') {
        return jsonRes(res, 200, sanitizeRecordForResponse(col, DataStore.findAll(col)));
      }

      if (method === 'POST') {
        if (!canWriteCollection(currentUser, col, method)) return denyForbidden(res);
        let body = await readBody(req);
        // CSRF Token Validation for state-changing operations
        const csrfToken = body._csrfToken;
        if (!validateCSRFToken(csrfToken, currentUser.id)) {
          return jsonRes(res, 403, { error: 'CSRF token inválido ou expirado. Recarregue a página e tente novamente.' });
        }
        if (col === 'usuarios') body = prepareUserForWrite(body);
        if (col === 'movimentos') {
          const errMov = validateMovement(body);
          if (errMov) return jsonRes(res, 400, { error: errMov });
        }
        if (col === 'ajustes') {
          const qtd = Number(body.quantidade);
          if (!(qtd > 0)) return jsonRes(res, 400, { error: 'Quantidade deve ser maior que zero.' });
          body.status = body.status || 'PENDENTE';
        }
        const registro = DataStore.insert(col, body);
        return jsonRes(res, 201, sanitizeRecordForResponse(col, registro));
      }

      if (method === 'PUT') {
        if (!canWriteCollection(currentUser, col, method)) return denyForbidden(res);
        if (!id) return jsonRes(res, 400, { error: 'ID obrigatório' });
        let body = await readBody(req);
        // CSRF Token Validation for state-changing operations
        const csrfToken = body._csrfToken;
        if (!validateCSRFToken(csrfToken, currentUser.id)) {
          return jsonRes(res, 403, { error: 'CSRF token inválido ou expirado. Recarregue a página e tente novamente.' });
        }
        // upsert: cria se não existir, atualiza se existir
        const existing = DataStore.findById(col, id);
        if (col === 'usuarios') body = prepareUserForWrite(body, existing);
        if (col === 'movimentos') return jsonRes(res, 405, { error: 'Movimentos nao podem ser alterados. Registre um ajuste.' });
        if (col === 'ajustes' && existing && existing.status !== 'APROVADO' && body.status === 'APROVADO') {
          return jsonRes(res, 409, { error: 'Aprovacao de ajuste deve usar o endpoint transacional.' });
        }
        body.id = id;
        const registro = DataStore.upsert(col, body);
        return jsonRes(res, 200, sanitizeRecordForResponse(col, registro));
      }

      if (method === 'DELETE') {
        if (!canWriteCollection(currentUser, col, method)) return denyForbidden(res);
        if (!id) return jsonRes(res, 400, { error: 'ID obrigatório' });
        let body = await readBody(req);
        // CSRF Token Validation for state-changing operations
        const csrfToken = body._csrfToken;
        if (!validateCSRFToken(csrfToken, currentUser.id)) {
          return jsonRes(res, 403, { error: 'CSRF token inválido ou expirado. Recarregue a página e tente novamente.' });
        }
        const removido = DataStore.remove(col, id);
        return jsonRes(res, removido ? ? 200 : 404, removido ? { ok: true } : { error: 'Registro não encontrado' });
      }

      return jsonRes(res, 405, { error: 'Método não permitido' });
    }

    // ── Arquivos estáticos ───────────────────────────────
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }

    const reqPath  = (pathname === '/')  '/index.html' : pathname;
    const safePath = path.resolve(ROOT, '.' + reqPath.replace(/\\/g, '/'));

    // Segurança: impedir path traversal
    if (!safePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Forbidden'); return;
    }
    // Bloquear acesso à pasta /data/
    if (safePath.startsWith(path.join(ROOT, 'data') + path.sep) || safePath === path.join(ROOT, 'data')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Forbidden'); return;
    }

    if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Página não encontrada'); return;
    }

    const ext    = path.extname(safePath).toLowerCase();
    const cached = _staticCache[safePath];

    if (cached) {
      // Cache-Control: HTML sempre revalidado, JS/CSS/imagens com TTL
      const cc = ext === '.html'
         'no-cache'
        : ((ext === '.js' || ext === '.css')  'public, max-age=300' : 'public, max-age=86400');
      // Se cliente tem ETag igual, retorna 304 sem body (sem download)
      if (req.headers['if-none-match'] === cached.etag) {
        res.writeHead(304, { 'ETag': cached.etag, 'Cache-Control': cc });
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type':   cached.mime,
        'Content-Length': cached.content.length,
        'ETag':           cached.etag,
        'Cache-Control':  cc,
      });
      if (method !== 'HEAD') res.end(cached.content);
      else res.end();
      return;
    }

    // Fallback: arquivo adicionado após o startup (não está no cache)
    const mime = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(safePath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
    res.end(data);

  } catch (err) {
    console.error('[Servidor] Erro:', err.message);
    if (!res.headersSent) jsonRes(res, 500, { error: 'Erro interno do servidor' });
  }
}

// Mantém conexões HTTP abertas — elimina TCP handshake entre páginas
server.keepAliveTimeout = 30000;
server.headersTimeout   = 31000;

server.listen(PORT, '0.0.0.0', function() {
  // Pega IP local da rede
  let localIP = 'localhost';
  try {
    const ifaces = os.networkInterfaces();
    Object.values(ifaces).forEach(function(list) {
      (list || []).forEach(function(i) {
        if (i.family === 'IPv4' && !i.internal) localIP = i.address;
      });
    });
  } catch {}

  const protocol = USE_HTTPS  'https' : 'http';
  const urlLocal = protocol + '://localhost:' + PORT;
  const urlLAN = protocol + '://' + localIP + ':' + PORT;
  const httpsLabel = USE_HTTPS  ' 🔒 HTTPS' : ' HTTP';

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   Atlas PCM — Almoxarifado  ✅  Online' + httpsLabel + '  ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log('  ║  Neste computador:  ' + urlLocal.padEnd(31) + ' ║');
  console.log('  ║  Na rede interna:   ' + urlLAN.padEnd(31) + ' ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Dados salvos em: ' + DATA_DIR);
  console.log('  Feche esta janela para parar o servidor.');
  if (USE_HTTPS) console.log('  ⚠️ ? HTTPS: Navegadores podem mostrar aviso (certificado auto-assinado)');
  console.log('');
});
