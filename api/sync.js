/* POST /api/sync { changes: [{ collection, op: "upsert"|"delete", id, item }] }
   Grava as alterações feitas no portal. Exige token e respeita o papel de quem alterou. */
import {
  ensureReady, getPool, upsertItem, deleteItem, logChange, summarize, verifyToken,
  send, readBody, handleError, COLLECTIONS
} from "./_lib/db.js";

const ACADEMIC_WRITE = ["admin", "professor"];

async function authorize(client, actor, change) {
  const { collection, op, id, item } = change;
  const role = actor.role;
  if (role === "admin") {
    if (collection === "users" && op === "delete") {
      const { rows } = await client.query("SELECT bloqueado FROM usuarios WHERE id = $1", [id]);
      if (rows[0]?.bloqueado) return { ok: false, reason: "Conta protegida não pode ser removida." };
    }
    return { ok: true };
  }
  switch (collection) {
    case "users":
      // Cada um só edita o próprio perfil (nome, e-mail, telefone)
      if (op === "upsert" && id === actor.sub) return { ok: true, keepFields: ["nome", "email", "telefone", "extra"] };
      return { ok: false, reason: "Somente a coordenação gerencia usuários." };
    case "turmas": {
      if (role !== "professor" || op !== "upsert") return { ok: false, reason: "Somente a coordenação gerencia turmas." };
      const { rows } = await client.query("SELECT professor_id FROM turmas WHERE id = $1", [id]);
      if (rows[0]?.professor_id !== actor.sub) return { ok: false, reason: "Turma de outro professor." };
      return { ok: true, keepFields: ["extra"] }; // professor só mexe na lista de alunos
    }
    case "notas":
    case "provas":
    case "atividades":
    case "faltas":
      return ACADEMIC_WRITE.includes(role) ? { ok: true } : { ok: false, reason: "Ação permitida só para professores." };
    case "chamados": {
      if (role === "professor") return { ok: false, reason: "Chamados são atendidos pela coordenação." };
      if (op === "delete") return { ok: false, reason: "Chamado não pode ser apagado." };
      if (item?.alunoId !== actor.sub) return { ok: false, reason: "Chamado de outro aluno." };
      // Aluno abre o chamado; quem muda status/resposta é a coordenação
      const { rows } = await client.query("SELECT 1 FROM chamados WHERE id = $1", [id]);
      if (rows.length) return { ok: false, reason: "Só a coordenação altera um chamado aberto." };
      if (item.status && item.status !== "aberto") return { ok: false, reason: "Chamado novo começa como aberto." };
      return { ok: true };
    }
    case "entregas":
      if (role === "aluno") {
        if (op === "delete") return { ok: false, reason: "Entrega não pode ser removida pelo aluno." };
        return item?.alunoId === actor.sub ? { ok: true } : { ok: false, reason: "Entrega de outro aluno." };
      }
      return { ok: true };
    default:
      return { ok: false, reason: "Coleção desconhecida." };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Use POST" });
  const actor = verifyToken(req);
  if (!actor) return send(res, 401, { ok: false, error: "Sessão expirada. Entre novamente." });

  try {
    await ensureReady();
    const { changes = [] } = await readBody(req);
    if (!Array.isArray(changes) || changes.length > 500) return send(res, 400, { ok: false, error: "Lote inválido" });

    const applied = [];
    const rejected = [];
    const client = await getPool().connect();
    try {
      for (const change of changes) {
        const { collection, op, id } = change || {};
        if (!COLLECTIONS[collection] || !["upsert", "delete"].includes(op) || !id) {
          rejected.push({ collection, id, reason: "Alteração inválida" });
          continue;
        }
        const perm = await authorize(client, actor, change);
        if (!perm.ok) {
          rejected.push({ collection, id, reason: perm.reason });
          continue;
        }
        try {
          await client.query("BEGIN");
          if (op === "upsert") {
            await upsertItem(client, collection, { ...change.item, id }, { keepFields: perm.keepFields });
          } else {
            await deleteItem(client, collection, id);
          }
          const seq = await logChange(client, {
            collection,
            id,
            op,
            actor,
            resumo: summarize(collection, change.item, op)
          });
          await client.query("COMMIT");
          applied.push({ collection, id, seq });
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          rejected.push({ collection, id, reason: err.message });
        }
      }
    } finally {
      client.release();
    }
    const seq = applied.length ? applied[applied.length - 1].seq : null;
    send(res, rejected.length && !applied.length ? 409 : 200, { ok: !rejected.length, seq, applied, rejected });
  } catch (err) {
    handleError(res, err);
  }
}
