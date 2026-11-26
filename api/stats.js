/* GET /api/stats — painel "Banco de dados" da coordenação: tabelas, contagens, tamanho, log e boletim. */
import { ensureReady, query, verifyToken, send, handleError, DATABASE_URL } from "./_lib/db.js";

const TABLES = [
  ["usuarios", "Usuários"],
  ["turmas", "Turmas"],
  ["turma_alunos", "Matrículas"],
  ["notas", "Notas"],
  ["provas", "Provas"],
  ["atividades", "Atividades"],
  ["entregas", "Entregas"],
  ["faltas", "Faltas"],
  ["log_alteracoes", "Log de alterações"]
];

export default async function handler(req, res) {
  const actor = verifyToken(req);
  if (!actor || actor.role !== "admin") return send(res, 403, { ok: false, error: "Somente a coordenação." });
  try {
    const t0 = Date.now();
    await ensureReady();
    const ping = Date.now();
    await query("SELECT 1");
    const latencyMs = Date.now() - ping;

    const counts = await query(
      `SELECT ${TABLES.map(([t]) => `(SELECT COUNT(*) FROM ${t})::int AS ${t}`).join(", ")},
              pg_size_pretty(pg_database_size(current_database())) AS tamanho,
              split_part(version(), ' ', 2) AS versao,
              current_database() AS banco`
    );
    const c = counts.rows[0];
    const { rows: log } = await query(
      `SELECT seq, colecao, item_id, operacao, autor_nome, resumo, em
       FROM log_alteracoes ORDER BY seq DESC LIMIT 25`
    );
    const { rows: boletim } = await query(
      `SELECT aluno, ra, turma, media, qtd_notas, faltas FROM vw_boletim ORDER BY turma, aluno LIMIT 50`
    );
    send(res, 200, {
      ok: true,
      provider: /neon/i.test(DATABASE_URL) ? "Neon Postgres" : "PostgreSQL",
      versao: c.versao,
      banco: c.banco,
      tamanho: c.tamanho,
      latencyMs,
      totalMs: Date.now() - t0,
      tables: TABLES.map(([t, label]) => ({ tabela: t, label, linhas: c[t] })),
      log,
      boletim
    });
  } catch (err) {
    handleError(res, err);
  }
}
