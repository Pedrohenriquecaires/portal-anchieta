/* POST /api/login { identifier, senha } → valida no servidor (bcrypt) e devolve um token assinado.
   Coordenação: usuário + senha · Professor/Aluno: RA + CPF */
import { ensureReady, query, readCollection, checkPassword, signToken, send, readBody, handleError } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Use POST" });
  try {
    await ensureReady();
    const { identifier = "", senha = "" } = await readBody(req);
    const id = String(identifier).trim();
    const digits = id.replace(/\D/g, "");
    if (!id || !senha) return send(res, 400, { ok: false, error: "Preencha RA/usuário e senha." });

    const { rows } = await query(
      `SELECT id, senha_hash, papel FROM usuarios
       WHERE (papel = 'admin' AND lower(login) = lower($1))
          OR (papel <> 'admin' AND $2 <> '' AND regexp_replace(ra, '\\D', '', 'g') = $2)
       LIMIT 5`,
      [id, digits]
    );

    const senhaDigits = String(senha).replace(/\D/g, "");
    for (const row of rows) {
      const ok =
        (await checkPassword(senha, row.senha_hash)) ||
        (row.papel !== "admin" && senhaDigits && (await checkPassword(senhaDigits, row.senha_hash)));
      if (ok) {
        const [user] = await readCollection("users", null, [row.id]);
        return send(res, 200, { ok: true, user, token: signToken(user) });
      }
    }
    send(res, 401, { ok: false, error: "RA/usuário ou senha inválidos. Professor e Aluno usam RA + CPF." });
  } catch (err) {
    handleError(res, err);
  }
}
