/* GET /api/state            → todos os dados (sem senhas) + número da última alteração
   GET /api/state?since=123  → só o que mudou depois da alteração 123 (sincronização) */
import { ensureReady, readAll, readCollection, query, send, handleError, COLLECTIONS } from "./_lib/db.js";

export default async function handler(req, res) {
  try {
    await ensureReady();
    const url = new URL(req.url, "http://x");
    const since = Number(url.searchParams.get("since"));

    if (!Number.isFinite(since) || since <= 0 || url.searchParams.get("since") === null) {
      return send(res, 200, { ok: true, full: true, ...(await readAll()) });
    }

    const { rows: maxRows } = await query("SELECT COALESCE(MAX(seq), 0) AS seq FROM log_alteracoes");
    const seq = Number(maxRows[0].seq);
    if (seq <= since) return send(res, 200, { ok: true, full: false, seq, changes: [], events: [] });

    // Um "reset" no meio do caminho → o cliente recarrega tudo
    const { rows: resets } = await query(
      "SELECT 1 FROM log_alteracoes WHERE seq > $1 AND operacao = 'reset' LIMIT 1",
      [since]
    );
    if (resets.length) return send(res, 200, { ok: true, full: true, reset: true, ...(await readAll()) });

    const { rows: latest } = await query(
      `SELECT DISTINCT ON (colecao, item_id) colecao, item_id, operacao
       FROM log_alteracoes WHERE seq > $1 ORDER BY colecao, item_id, seq DESC`,
      [since]
    );
    const changes = [];
    const byCollection = {};
    for (const r of latest) {
      if (!COLLECTIONS[r.colecao]) continue;
      if (r.operacao === "delete") changes.push({ collection: r.colecao, op: "delete", id: r.item_id });
      else (byCollection[r.colecao] ||= []).push(r.item_id);
    }
    for (const [name, ids] of Object.entries(byCollection)) {
      const items = await readCollection(name, null, ids);
      const found = new Set(items.map((i) => i.id));
      items.forEach((item) => changes.push({ collection: name, op: "upsert", id: item.id, item }));
      ids.filter((id) => !found.has(id)).forEach((id) => changes.push({ collection: name, op: "delete", id }));
    }
    const { rows: events } = await query(
      `SELECT seq, colecao, item_id, operacao, autor_id, autor_nome, resumo, em
       FROM log_alteracoes WHERE seq > $1 ORDER BY seq DESC LIMIT 10`,
      [since]
    );
    send(res, 200, { ok: true, full: false, seq, changes, events });
  } catch (err) {
    handleError(res, err);
  }
}
