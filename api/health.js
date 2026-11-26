/* GET /api/health — diz ao front se o banco está disponível (senão ele usa o modo local). */
import { ensureReady, query, send, handleError, DATABASE_URL } from "./_lib/db.js";

export default async function handler(req, res) {
  if (!DATABASE_URL) return send(res, 200, { ok: false, mode: "local", reason: "DATABASE_URL não configurada" });
  try {
    const t0 = Date.now();
    await ensureReady();
    const { rows } = await query("SELECT version() AS v, now() AS agora");
    send(res, 200, {
      ok: true,
      mode: "online",
      provider: /neon/i.test(DATABASE_URL) ? "Neon Postgres" : "PostgreSQL",
      version: String(rows[0].v).split(" ").slice(0, 2).join(" "),
      latencyMs: Date.now() - t0,
      serverTime: rows[0].agora
    });
  } catch (err) {
    handleError(res, err);
  }
}
