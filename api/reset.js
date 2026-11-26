/* POST /api/reset — coordenação restaura o banco para os dados de demonstração. */
import { ensureReady, getPool, wipeDatabase, seedDatabase, verifyToken, send, handleError } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Use POST" });
  const actor = verifyToken(req);
  if (!actor || actor.role !== "admin") return send(res, 403, { ok: false, error: "Somente a coordenação." });
  try {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(424242)");
      await wipeDatabase(client);
      await seedDatabase(client, { sub: actor.sub, nome: actor.nome });
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    send(res, 200, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}
