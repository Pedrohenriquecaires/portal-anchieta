/* ============================================================
   Portal Anchieta — camada de dados (Postgres / Neon)
   ------------------------------------------------------------
   - Pool de conexões compartilhado pela instância da função
   - Criação do schema (tabelas relacionais + log de auditoria)
   - Seed automático com os dados de demonstração
   - Conversão objeto do front  <->  linha do banco
   - Tokens de sessão assinados (HMAC) e senhas com bcrypt
   ============================================================ */

import pg from "pg";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import SEED from "./seed.js";

const { Pool, types } = pg;

// DATE volta como "AAAA-MM-DD", TIMESTAMPTZ como ISO, NUMERIC como número
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1184, (v) => (v ? new Date(v).toISOString() : v));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const DATABASE_URL =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || "";

let pool = null;
export function getPool() {
  if (!DATABASE_URL) {
    const err = new Error("DATABASE_URL não configurada");
    err.code = "NO_DATABASE";
    throw err;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 8000
    });
    pool.on("error", () => {
      /* conexão ociosa caiu: o pool recria na próxima consulta */
    });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

/* ---------------- Schema ---------------- */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  login         TEXT NOT NULL DEFAULT '',
  ra            TEXT NOT NULL DEFAULT '',
  cpf           TEXT NOT NULL DEFAULT '',
  senha_hash    TEXT,
  email         TEXT NOT NULL DEFAULT '',
  telefone      TEXT NOT NULL DEFAULT '',
  papel         TEXT NOT NULL CHECK (papel IN ('admin', 'professor', 'aluno')),
  meta          TEXT NOT NULL DEFAULT '',
  bloqueado     BOOLEAN NOT NULL DEFAULT false,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usuarios_ra_idx ON usuarios (ra);

CREATE TABLE IF NOT EXISTS turmas (
  id             TEXT PRIMARY KEY,
  nome           TEXT NOT NULL,
  codigo         TEXT NOT NULL DEFAULT '',
  professor_id   TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  professor_ra   TEXT NOT NULL DEFAULT '',
  professor_nome TEXT NOT NULL DEFAULT '',
  horario        TEXT NOT NULL DEFAULT '',
  extra          JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turma_alunos (
  turma_id   TEXT NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
  aluno_id   TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  posicao    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (turma_id, aluno_id)
);

CREATE TABLE IF NOT EXISTS notas (
  id            TEXT PRIMARY KEY,
  turma_id      TEXT NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
  aluno_id      TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  valor         NUMERIC(4, 2) CHECK (valor BETWEEN 0 AND 10),
  tipo          TEXT NOT NULL DEFAULT '',
  observacao    TEXT NOT NULL DEFAULT '',
  professor_id  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notas_aluno_idx ON notas (aluno_id);

CREATE TABLE IF NOT EXISTS atividades (
  id            TEXT PRIMARY KEY,
  turma_id      TEXT NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descricao     TEXT NOT NULL DEFAULT '',
  prazo         DATE,
  tipo          TEXT NOT NULL DEFAULT 'atividade',
  professor_id  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provas (
  id            TEXT PRIMARY KEY,
  turma_id      TEXT NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descricao     TEXT NOT NULL DEFAULT '',
  data          DATE,
  peso          NUMERIC(5, 2),
  status        TEXT NOT NULL DEFAULT 'agendada',
  professor_id  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faltas (
  id            TEXT PRIMARY KEY,
  turma_id      TEXT NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
  aluno_id      TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  data          DATE,
  motivo        TEXT NOT NULL DEFAULT '',
  professor_id  TEXT REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entregas (
  id            TEXT PRIMARY KEY,
  atividade_id  TEXT NOT NULL REFERENCES atividades (id) ON DELETE CASCADE,
  aluno_id      TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  texto         TEXT NOT NULL DEFAULT '',
  criado_em     TIMESTAMPTZ,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chamados de suporte abertos pelos alunos (atendidos pela coordenação)
CREATE TABLE IF NOT EXISTS chamados (
  id            TEXT PRIMARY KEY,
  protocolo     TEXT NOT NULL DEFAULT '',
  aluno_id      TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  categoria     TEXT NOT NULL DEFAULT 'Outro',
  assunto       TEXT NOT NULL,
  mensagem      TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'resolvido')),
  resposta      TEXT NOT NULL DEFAULT '',
  criado_em     TIMESTAMPTZ,
  extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chamados_aluno_idx ON chamados (aluno_id);

-- Log de auditoria: cada alteração vira um evento (também usado na sincronização)
CREATE TABLE IF NOT EXISTS log_alteracoes (
  seq        BIGSERIAL PRIMARY KEY,
  colecao    TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  operacao   TEXT NOT NULL CHECK (operacao IN ('upsert', 'delete', 'reset')),
  autor_id   TEXT,
  autor_nome TEXT,
  resumo     TEXT NOT NULL DEFAULT '',
  em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS log_colecao_item_idx ON log_alteracoes (colecao, item_id, seq DESC);

-- Visão pronta para relatórios: boletim com média por aluno e turma
CREATE OR REPLACE VIEW vw_boletim AS
SELECT u.id AS aluno_id, u.nome AS aluno, u.ra, t.id AS turma_id, t.nome AS turma,
       ROUND(AVG(n.valor)::numeric, 2) AS media, COUNT(n.id) AS qtd_notas,
       (SELECT COUNT(*) FROM faltas f WHERE f.aluno_id = u.id AND f.turma_id = t.id) AS faltas
FROM turma_alunos ta
JOIN usuarios u ON u.id = ta.aluno_id
JOIN turmas t   ON t.id = ta.turma_id
LEFT JOIN notas n ON n.aluno_id = u.id AND n.turma_id = t.id
GROUP BY u.id, u.nome, u.ra, t.id, t.nome;
`;

/* ---------------- Mapeamento coleção <-> tabela ---------------- */

// campo do front : [coluna, tipo]   (tipo: text | date | ts | num | bool | fk)
export const COLLECTIONS = {
  users: {
    table: "usuarios",
    label: "Usuários",
    fields: {
      id: ["id", "text"],
      nome: ["nome", "text"],
      login: ["login", "text"],
      ra: ["ra", "text"],
      cpf: ["cpf", "text"],
      email: ["email", "text"],
      telefone: ["telefone", "text"],
      role: ["papel", "text"],
      meta: ["meta", "text"],
      locked: ["bloqueado", "bool"]
    },
    skip: ["senha"]
  },
  turmas: {
    table: "turmas",
    label: "Turmas",
    fields: {
      id: ["id", "text"],
      nome: ["nome", "text"],
      codigo: ["codigo", "text"],
      professorId: ["professor_id", "fk"],
      professorRa: ["professor_ra", "text"],
      professorNome: ["professor_nome", "text"],
      horario: ["horario", "text"]
    },
    skip: ["alunosIds"]
  },
  notas: {
    table: "notas",
    label: "Notas",
    fields: {
      id: ["id", "text"],
      turmaId: ["turma_id", "fk"],
      alunoId: ["aluno_id", "fk"],
      valor: ["valor", "num"],
      tipo: ["tipo", "text"],
      observacao: ["observacao", "text"],
      professorId: ["professor_id", "fk"],
      createdAt: ["criado_em", "ts"]
    }
  },
  atividades: {
    table: "atividades",
    label: "Atividades",
    fields: {
      id: ["id", "text"],
      turmaId: ["turma_id", "fk"],
      titulo: ["titulo", "text"],
      descricao: ["descricao", "text"],
      prazo: ["prazo", "date"],
      tipo: ["tipo", "text"],
      professorId: ["professor_id", "fk"],
      createdAt: ["criado_em", "ts"]
    }
  },
  provas: {
    table: "provas",
    label: "Provas",
    fields: {
      id: ["id", "text"],
      turmaId: ["turma_id", "fk"],
      titulo: ["titulo", "text"],
      descricao: ["descricao", "text"],
      data: ["data", "date"],
      peso: ["peso", "num"],
      status: ["status", "text"],
      professorId: ["professor_id", "fk"],
      createdAt: ["criado_em", "ts"]
    }
  },
  faltas: {
    table: "faltas",
    label: "Faltas",
    fields: {
      id: ["id", "text"],
      turmaId: ["turma_id", "fk"],
      alunoId: ["aluno_id", "fk"],
      data: ["data", "date"],
      motivo: ["motivo", "text"],
      professorId: ["professor_id", "fk"],
      createdAt: ["criado_em", "ts"]
    }
  },
  entregas: {
    table: "entregas",
    label: "Entregas",
    fields: {
      id: ["id", "text"],
      atividadeId: ["atividade_id", "fk"],
      alunoId: ["aluno_id", "fk"],
      texto: ["texto", "text"],
      createdAt: ["criado_em", "ts"]
    }
  },
  chamados: {
    table: "chamados",
    label: "Chamados",
    fields: {
      id: ["id", "text"],
      protocolo: ["protocolo", "text"],
      alunoId: ["aluno_id", "fk"],
      categoria: ["categoria", "text"],
      assunto: ["assunto", "text"],
      mensagem: ["mensagem", "text"],
      status: ["status", "text"],
      resposta: ["resposta", "text"],
      createdAt: ["criado_em", "ts"]
    }
  }
};

export const COLLECTION_ORDER = ["users", "turmas", "atividades", "provas", "notas", "faltas", "entregas", "chamados"];

function toColumnValue(value, type) {
  if (value === undefined) return undefined;
  if (type === "bool") return Boolean(value);
  if (type === "num") {
    if (value === "" || value === null) return null;
    const n = Number(String(value).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "date" || type === "ts" || type === "fk") {
    return value === "" || value === null ? null : String(value);
  }
  return value === null ? "" : String(value);
}

/** Objeto do front -> { colunas, extra } */
export function toRow(collection, item) {
  const cfg = COLLECTIONS[collection];
  const row = {};
  const extra = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (cfg.skip?.includes(key)) continue;
    const map = cfg.fields[key];
    if (map) {
      const v = toColumnValue(value, map[1]);
      if (v !== undefined) row[map[0]] = v;
    } else {
      extra[key] = value;
    }
  }
  row.extra = extra;
  return row;
}

/** Linha do banco -> objeto do front */
export function fromRow(collection, row) {
  const cfg = COLLECTIONS[collection];
  const item = { ...(row.extra || {}) };
  for (const [key, [col]] of Object.entries(cfg.fields)) {
    const v = row[col];
    if (v === null || v === undefined) continue;
    item[key] = v;
  }
  if (collection === "turmas") item.alunosIds = row.alunos_ids || [];
  return item;
}

/* ---------------- Leitura ---------------- */

export async function readCollection(collection, client = null, ids = null) {
  const cfg = COLLECTIONS[collection];
  const q = client || getPool();
  const where = ids ? "WHERE t.id = ANY($1)" : "";
  const params = ids ? [ids] : [];
  let sql;
  if (collection === "turmas") {
    sql = `SELECT t.*, COALESCE(
             (SELECT array_agg(ta.aluno_id ORDER BY ta.posicao, ta.aluno_id) FROM turma_alunos ta WHERE ta.turma_id = t.id),
             '{}') AS alunos_ids
           FROM turmas t ${where} ORDER BY t.nome`;
  } else if (collection === "users") {
    sql = `SELECT t.* FROM usuarios t ${where}
           ORDER BY CASE t.papel WHEN 'admin' THEN 0 WHEN 'professor' THEN 1 ELSE 2 END, t.criado_em, t.nome`;
  } else {
    const order = cfg.fields.createdAt ? "t.criado_em NULLS FIRST, t.id" : "t.id";
    sql = `SELECT t.* FROM ${cfg.table} t ${where} ORDER BY ${order}`;
  }
  const { rows } = await q.query(sql, params);
  return rows.map((r) => fromRow(collection, r));
}

export async function readAll() {
  const data = {};
  for (const name of COLLECTION_ORDER) data[name] = await readCollection(name);
  const { rows } = await query("SELECT COALESCE(MAX(seq), 0) AS seq FROM log_alteracoes");
  return { seq: Number(rows[0].seq), data };
}

/* ---------------- Escrita ---------------- */

function isBcrypt(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function upsertItem(client, collection, item, { keepFields } = {}) {
  const cfg = COLLECTIONS[collection];
  const row = toRow(collection, item);
  if (!row.id) throw Object.assign(new Error("Item sem id"), { status: 400 });

  if (collection === "users") {
    if (item.senha && !isBcrypt(item.senha)) row.senha_hash = await bcrypt.hash(String(item.senha), 8);
    else if (isBcrypt(item.senha)) row.senha_hash = item.senha;
  }

  let cols = Object.keys(row);
  if (keepFields) {
    // Alteração parcial (professor na turma, usuário no próprio perfil):
    // UPDATE só nas colunas permitidas — nunca um INSERT incompleto.
    const allowed = cols.filter((c) => c !== "id" && keepFields.includes(c));
    if (allowed.length) {
      const sets = allowed.map((c, i) => (c === "extra" ? `${c} = $${i + 2}::jsonb` : `${c} = $${i + 2}`));
      await client.query(
        `UPDATE ${cfg.table} SET ${sets.join(", ")}, atualizado_em = now() WHERE id = $1`,
        [row.id, ...allowed.map((c) => (c === "extra" ? JSON.stringify(row[c]) : row[c]))]
      );
    }
    if (collection === "turmas" && Array.isArray(item.alunosIds)) await saveTurmaAlunos(client, row.id, item.alunosIds);
    return;
  }

  const values = cols.map((c) => (c === "extra" ? JSON.stringify(row[c]) : row[c]));
  const placeholders = cols.map((c, i) => (c === "extra" ? `$${i + 1}::jsonb` : `$${i + 1}`));
  const updates = cols
    .filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat(["atualizado_em = now()"]);

  await client.query(
    `INSERT INTO ${cfg.table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
    values
  );

  if (collection === "turmas" && Array.isArray(item.alunosIds)) await saveTurmaAlunos(client, row.id, item.alunosIds);
}

async function saveTurmaAlunos(client, turmaId, alunosIds) {
  await client.query("DELETE FROM turma_alunos WHERE turma_id = $1", [turmaId]);
  const unique = [...new Set(alunosIds.map(String))];
  if (unique.length) {
    await client.query(
      `INSERT INTO turma_alunos (turma_id, aluno_id, posicao)
       SELECT $1, a.id, a.pos FROM unnest($2::text[]) WITH ORDINALITY AS a(id, pos)
       WHERE EXISTS (SELECT 1 FROM usuarios u WHERE u.id = a.id)`,
      [turmaId, unique]
    );
  }
}

export async function deleteItem(client, collection, id) {
  const cfg = COLLECTIONS[collection];
  await client.query(`DELETE FROM ${cfg.table} WHERE id = $1`, [id]);
}

export function summarize(collection, item, op) {
  if (!item) return op === "delete" ? "Registro removido" : "";
  const nota = (v) => (v === undefined || v === null ? "" : String(v).replace(".", ","));
  switch (collection) {
    case "users":
      return `${item.nome || "Usuário"}${item.role ? ` (${item.role})` : ""}`;
    case "turmas":
      return `${item.nome || "Turma"}${Array.isArray(item.alunosIds) ? ` · ${item.alunosIds.length} aluno(s)` : ""}`;
    case "notas":
      return `${item.tipo || "Nota"} ${nota(item.valor)}`.trim();
    case "provas":
    case "atividades":
      return item.titulo || "";
    case "faltas":
      return `Falta em ${item.data || ""}`.trim();
    case "entregas":
      return "Entrega de atividade";
    case "chamados": {
      const st = { aberto: "aberto", em_atendimento: "em atendimento", resolvido: "resolvido" }[item.status] || "";
      return `${item.protocolo || "Chamado"} · ${item.assunto || ""}${st ? ` (${st})` : ""}`;
    }
    default:
      return "";
  }
}

export async function logChange(client, { collection, id, op, actor, resumo }) {
  const { rows } = await client.query(
    `INSERT INTO log_alteracoes (colecao, item_id, operacao, autor_id, autor_nome, resumo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING seq`,
    [collection, id, op, actor?.sub || null, actor?.nome || null, resumo || ""]
  );
  return Number(rows[0].seq);
}

/* ---------------- Seed ---------------- */

function todaySaoPaulo() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function loadSeed() {
  const seed = structuredClone(SEED);
  // A prova "P2 - Apresentação" fica sempre na data de hoje (fuso de São Paulo)
  const p2 = (seed.provas || []).find((p) => p.id === "p-demo-2");
  if (p2) {
    p2.data = todaySaoPaulo();
    p2.createdAt = new Date().toISOString();
  }
  return seed;
}

export async function seedDatabase(client, actor = null) {
  const seed = loadSeed();
  for (const name of COLLECTION_ORDER) {
    for (const item of seed[name] || []) await upsertItem(client, name, item);
  }
  await logChange(client, {
    collection: "sistema",
    id: "seed",
    op: "reset",
    actor: actor || { sub: null, nome: "Sistema" },
    resumo: "Banco inicializado com os dados de demonstração"
  });
}

export async function wipeDatabase(client) {
  await client.query(
    "TRUNCATE chamados, entregas, faltas, notas, provas, atividades, turma_alunos, turmas, usuarios RESTART IDENTITY CASCADE"
  );
}

let readyPromise = null;
/** Garante schema + seed (uma vez por instância da função). */
export function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(424242)");
        await client.query(SCHEMA);
        const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM usuarios");
        if (rows[0].n === 0) await seedDatabase(client);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/* ---------------- Sessão (token assinado) ---------------- */

const SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update(`portal-anchieta:${DATABASE_URL}`).digest("hex");

export function signToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    nome: user.nome,
    exp: Date.now() + 12 * 60 * 60 * 1000
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(req) {
  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function checkPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), hash);
}

/* ---------------- HTTP helpers ---------------- */

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

export function handleError(res, err) {
  if (err?.code === "NO_DATABASE") {
    return send(res, 503, { ok: false, mode: "local", error: "Banco de dados não configurado (DATABASE_URL)." });
  }
  console.error("[api]", err);
  return send(res, err?.status || 500, { ok: false, error: err?.message || "Erro interno" });
}
