/* ============================================================
   Portal Anchieta — servicos.js
   Ações rápidas do aluno (Dashboard):
   1. 2ª via de boleto  → mensalidades do semestre, linha digitável,
                          2ª via imprimível (documento de demonstração)
   2. Grade de horários → semana montada a partir das turmas do aluno
                          + exportação para Google Agenda/Outlook (.ics)
   3. Documentos        → declaração, atestado de frequência e boletim
                          gerados com os dados reais (imprimir / PDF)
   4. Suporte           → abre chamado com protocolo (salvo no banco);
                          a coordenação atende pelo Painel Coordenação
   ============================================================ */

(() => {
  "use strict";

  const KEYS = {
    users: "educonnect-users-v2",
    turmas: "educonnect-turmas-v2",
    notas: "educonnect-notas-v1",
    faltas: "educonnect-faltas-v1",
    provas: "educonnect-provas-v1",
    chamados: "educonnect-chamados-v1"
  };

  const SEMESTRE = { nome: "2026.2", inicio: "2026-08-03", fim: "2026-12-12" };
  const MENSALIDADE = 1289.0;
  const DIAS = [
    { key: "Seg", nome: "Segunda", js: 1 },
    { key: "Ter", nome: "Terça", js: 2 },
    { key: "Qua", nome: "Quarta", js: 3 },
    { key: "Qui", nome: "Quinta", js: 4 },
    { key: "Sex", nome: "Sexta", js: 5 },
    { key: "Sáb", nome: "Sábado", js: 6 }
  ];

  /* ---------------- Dados ---------------- */

  function read(key) {
    try {
      const v = JSON.parse(localStorage.getItem(KEYS[key]) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function me() {
    // currentUser é global do script.js
    try {
      // eslint-disable-next-line no-undef
      return typeof currentUser !== "undefined" ? currentUser : null;
    } catch {
      return null;
    }
  }

  function turmasDoAluno(alunoId) {
    return read("turmas").filter((t) => Array.isArray(t.alunosIds) && t.alunosIds.includes(alunoId));
  }

  function media(lista) {
    if (!lista.length) return null;
    return lista.reduce((acc, n) => acc + Number(n.valor || 0), 0) / lista.length;
  }

  const fmtNota = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(1).replace(".", ","));
  const fmtMoeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = (iso) => {
    const [y, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  };
  const hojeISO = () => new Date().toLocaleDateString("sv-SE");

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function snack(message, options) {
    if (typeof window.showSnackbar === "function") window.showSnackbar(message, options);
  }

  function codigoVerificacao(...partes) {
    let h = 2166136261;
    const s = partes.join("|");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
  }

  /* ---------------- Dialog genérico ---------------- */

  let root = null;
  let lastFocus = null;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "dialog-root";
    root.hidden = true;
    root.innerHTML = `
      <button class="dialog-scrim" type="button" aria-label="Fechar" tabindex="-1" data-svc-close></button>
      <div class="dialog dialog--svc" role="dialog" aria-modal="true" aria-labelledby="svcTitle">
        <div class="svc-head">
          <span class="svc-head__icon material-symbols-outlined" id="svcIcon" aria-hidden="true">apps</span>
          <div>
            <p class="eyebrow" id="svcEyebrow"></p>
            <h2 class="dialog__title" id="svcTitle"></h2>
          </div>
          <button class="icon-btn svc-close" type="button" aria-label="Fechar" data-svc-close>
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div class="svc-body" id="svcBody"></div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-svc-close]")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (root.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const f = [...root.querySelectorAll("button, a[href], input, select, textarea")].filter(
          (el) => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1
        );
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    });
    return root;
  }

  function open({ icon, eyebrow, title, html, wide = true }) {
    ensureRoot();
    lastFocus = document.activeElement;
    root.querySelector("#svcIcon").textContent = icon;
    root.querySelector("#svcEyebrow").textContent = eyebrow;
    root.querySelector("#svcTitle").textContent = title;
    root.querySelector("#svcBody").innerHTML = html;
    root.querySelector(".dialog").classList.toggle("dialog--svc-wide", wide);
    root.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => root.querySelector(".svc-close").focus());
    return root.querySelector("#svcBody");
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  /* ---------------- Janela imprimível (PDF) ---------------- */

  function printWindow(title, bodyHtml) {
    const w = window.open("", "_blank");
    if (!w) {
      snack("Libere os pop-ups do site para gerar o documento.", { icon: "error" });
      return;
    }
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; color: #0e111b; margin: 0; padding: 32px; background: #f3f5fa; }
  .doc { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e3e7ef; border-radius: 12px; padding: 48px; position: relative; overflow: hidden; }
  .doc::before { content: "DOCUMENTO DE DEMONSTRAÇÃO · SEM VALOR"; position: absolute; top: 46%; left: -10%; right: -10%; text-align: center; transform: rotate(-24deg);
    font-size: 30px; font-weight: 700; letter-spacing: .08em; color: rgba(98, 95, 255, .10); pointer-events: none; }
  header { display: flex; align-items: center; gap: 14px; padding-bottom: 20px; border-bottom: 2px solid #0e111b; margin-bottom: 28px; }
  .mark { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(90deg,#305fbd,#625fff); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 20px; }
  header strong { display: block; font-size: 18px; } header small { color: #646a7d; }
  h1 { font-size: 22px; letter-spacing: -.02em; margin: 0 0 18px; text-transform: uppercase; }
  p { line-height: 1.7; font-size: 14.5px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13.5px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #e3e7ef; }
  th { background: #f3f5fa; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #646a7d; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; }
  .sign { margin-top: 56px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; font-size: 12.5px; color: #3c4257; }
  .sign .line { border-top: 1px solid #0e111b; padding-top: 6px; min-width: 240px; text-align: center; }
  .verify { font-size: 11.5px; color: #646a7d; }
  .bar { height: 56px; margin: 18px 0 6px; display: flex; align-items: stretch; gap: 0; }
  .bar i { display: block; background: #0e111b; }
  .actions { max-width: 760px; margin: 18px auto 0; display: flex; gap: 10px; justify-content: flex-end; }
  .actions button { font: inherit; border: 0; border-radius: 999px; padding: 10px 20px; cursor: pointer; background: #0e111b; color: #fff; }
  .actions button.ghost { background: transparent; color: #0e111b; border: 1px solid #c3cad8; }
  .box { border: 1px solid #c3cad8; border-radius: 8px; padding: 12px 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #646a7d; }
  .val { font-size: 14px; font-weight: 600; margin-top: 2px; }
  @media print { body { background: #fff; padding: 0; } .doc { border: 0; padding: 0; } .actions { display: none; } }
</style></head><body>
<div class="doc">
  <header><div class="mark">A</div><div><strong>Centro Universitário Anchieta</strong><small>Portal Anchieta · Secretaria Acadêmica</small></div></header>
  ${bodyHtml}
</div>
<div class="actions"><button class="ghost" onclick="window.close()">Fechar</button><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
</body></html>`);
    w.document.close();
    w.focus();
  }

  /* ================= 1. 2ª VIA DE BOLETO ================= */

  function mensalidades(user) {
    const meses = ["Ago", "Set", "Out", "Nov", "Dez"];
    const nomes = ["Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const hoje = hojeISO();
    return meses.map((m, i) => {
      const mes = String(8 + i).padStart(2, "0");
      const venc = `2026-${mes}-10`;
      const pago = venc < hoje && i < 3; // Ago, Set, Out pagos
      const status = pago ? "pago" : venc < hoje ? "vencido" : "aberto";
      const multa = status === "vencido" ? MENSALIDADE * 0.02 : 0;
      const ra = String(user.ra || "0").replace(/\D/g, "").padStart(7, "0");
      const nosso = `${ra}${mes}26`;
      const linha = linhaDigitavel(ra, mes, MENSALIDADE + multa);
      return { id: `${m}-2026`, mes: `${nomes[i]}/2026`, curto: m, venc, status, valor: MENSALIDADE, multa, nosso, linha };
    });
  }

  function linhaDigitavel(ra, mes, valor) {
    // Linha fictícia, mas no formato de 47 dígitos (5.5 5.6 5.6 1 14)
    const centavos = String(Math.round(valor * 100)).padStart(10, "0");
    const base = `00190${ra}${mes}2026${ra.slice(-4)}${mes}7${"0".repeat(5)}`.replace(/\D/g, "");
    const d = (base + "0".repeat(40)).slice(0, 32);
    const fator = "9851";
    const all = `${d}${fator}${centavos}`.slice(0, 47).padEnd(47, "0");
    return `${all.slice(0, 5)}.${all.slice(5, 10)} ${all.slice(10, 15)}.${all.slice(15, 21)} ${all.slice(21, 26)}.${all.slice(
      26,
      32
    )} ${all.slice(32, 33)} ${all.slice(33)}`;
  }

  function openBoletos() {
    const user = me();
    if (!user) return;
    const lista = mensalidades(user);
    const emAberto = lista.filter((b) => b.status !== "pago");
    const total = emAberto.reduce((a, b) => a + b.valor + b.multa, 0);
    const chip = {
      pago: '<span class="chip chip--success">Pago</span>',
      vencido: '<span class="chip chip--error">Vencido</span>',
      aberto: '<span class="chip chip--warning">A vencer</span>'
    };
    const body = open({
      icon: "receipt_long",
      eyebrow: `Área financeira · Semestre ${SEMESTRE.nome}`,
      title: "2ª via de boleto",
      html: `
        <div class="svc-summary">
          <div><span>Em aberto</span><strong>${fmtMoeda(total)}</strong></div>
          <div><span>Mensalidade</span><strong>${fmtMoeda(MENSALIDADE)}</strong></div>
          <div><span>Pagas</span><strong>${lista.length - emAberto.length} de ${lista.length}</strong></div>
        </div>
        <ul class="svc-list">
          ${lista
            .map(
              (b) => `
            <li class="svc-item svc-item--${b.status}">
              <div class="svc-item__main">
                <strong>${b.mes}</strong>
                <small>Vencimento ${fmtData(b.venc)} · ${fmtMoeda(b.valor + b.multa)}${b.multa ? " (com multa de 2%)" : ""}</small>
              </div>
              ${chip[b.status]}
              ${
                b.status === "pago"
                  ? '<span class="svc-item__done material-symbols-outlined" aria-label="Pago">check_circle</span>'
                  : `<div class="svc-item__actions">
                      <button class="btn btn--text" type="button" data-copy="${b.linha}">
                        <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>Copiar código
                      </button>
                      <button class="btn btn--filled" type="button" data-boleto="${b.id}">
                        <span class="material-symbols-outlined" aria-hidden="true">download</span>2ª via
                      </button>
                    </div>`
              }
            </li>`
            )
            .join("")}
        </ul>
        <p class="svc-note"><span class="material-symbols-outlined" aria-hidden="true">info</span>
          Ambiente acadêmico de demonstração: valores e códigos são fictícios e não servem para pagamento.</p>`
    });

    body.querySelectorAll("[data-copy]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const text = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">check</span>Copiado!';
        snack("Linha digitável copiada.", { icon: "content_copy" });
        setTimeout(
          () => (btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">content_copy</span>Copiar código'),
          2000
        );
      })
    );

    body.querySelectorAll("[data-boleto]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const b = lista.find((x) => x.id === btn.dataset.boleto);
        const bars = b.linha
          .replace(/\D/g, "")
          .split("")
          .map((d, i) => `<i style="width:${(Number(d) % 3) + 1}px;margin-right:${((Number(d) + i) % 3) + 1}px"></i>`)
          .join("");
        printWindow(
          `2ª via — ${b.mes}`,
          `<h1>2ª via de boleto · ${esc(b.mes)}</h1>
          <div class="grid2">
            <div class="box"><div class="label">Beneficiário</div><div class="val">Centro Universitário Anchieta</div></div>
            <div class="box"><div class="label">Vencimento</div><div class="val">${fmtData(b.venc)}</div></div>
            <div class="box"><div class="label">Pagador</div><div class="val">${esc(user.nome)}</div></div>
            <div class="box"><div class="label">RA</div><div class="val mono">${esc(user.ra)}</div></div>
            <div class="box"><div class="label">Nosso número</div><div class="val mono">${esc(b.nosso)}</div></div>
            <div class="box"><div class="label">Valor do documento</div><div class="val">${fmtMoeda(b.valor + b.multa)}</div></div>
          </div>
          <p class="mono" style="font-size:15px;margin:22px 0 0">${esc(b.linha)}</p>
          <div class="bar">${bars}</div>
          <p class="verify">Documento gerado pelo Portal Anchieta em ${new Date().toLocaleString("pt-BR")} ·
          ambiente acadêmico de demonstração, sem valor para pagamento.</p>`
        );
      })
    );
  }

  /* ================= 2. GRADE DE HORÁRIOS ================= */

  function parseHorario(texto) {
    // "Seg/Qua 19:00–20:40" → { dias: ["Seg","Qua"], inicio: "19:00", fim: "20:40" }
    const m = String(texto || "").match(/^([A-Za-zÀ-ú/ ,e]+?)\s+(\d{1,2}[:h]\d{2})\s*[–—-]\s*(\d{1,2}[:h]\d{2})/);
    if (!m) return null;
    const norm = (s) =>
      s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .slice(0, 3);
    const dias = m[1]
      .split(/[\/,]| e /)
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => DIAS.find((x) => norm(x.key) === norm(d))?.key)
      .filter(Boolean);
    const fix = (t) => t.replace("h", ":").padStart(5, "0");
    return dias.length ? { dias, inicio: fix(m[2]), fim: fix(m[3]) } : null;
  }

  function aulasDoAluno(user) {
    const professores = read("users");
    const aulas = [];
    turmasDoAluno(user.id).forEach((t) => {
      const h = parseHorario(t.horario);
      if (!h) return;
      const prof = professores.find((u) => u.id === t.professorId)?.nome || t.professorNome || "";
      h.dias.forEach((dia) => aulas.push({ dia, inicio: h.inicio, fim: h.fim, turma: t, prof }));
    });
    return aulas.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  function openGrade() {
    const user = me();
    if (!user) return;
    const aulas = aulasDoAluno(user);
    const hojeKey = DIAS.find((d) => d.js === new Date().getDay())?.key;
    const diasUsados = DIAS.filter((d) => d.js <= 5 || aulas.some((a) => a.dia === d.key));
    const proxima = (() => {
      const agora = new Date();
      for (let i = 0; i < 7; i++) {
        const dt = new Date(agora);
        dt.setDate(agora.getDate() + i);
        const key = DIAS.find((d) => d.js === dt.getDay())?.key;
        const hhmm = agora.toTimeString().slice(0, 5);
        const doDia = aulas.filter((a) => a.dia === key && (i > 0 || a.fim > hhmm));
        if (doDia.length) return { ...doDia[0], quando: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : DIAS.find((d) => d.key === key).nome };
      }
      return null;
    })();

    const body = open({
      icon: "calendar_view_week",
      eyebrow: `Semestre ${SEMESTRE.nome} · ${fmtData(SEMESTRE.inicio)} a ${fmtData(SEMESTRE.fim)}`,
      title: "Grade de horários",
      html: aulas.length
        ? `
        ${
          proxima
            ? `<div class="svc-next"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>
                <div><small>Próxima aula · ${esc(proxima.quando)}, ${esc(proxima.inicio)}</small>
                <strong>${esc(proxima.turma.nome)}</strong></div></div>`
            : ""
        }
        <div class="svc-week" style="--cols:${diasUsados.length}">
          ${diasUsados
            .map((d) => {
              const doDia = aulas.filter((a) => a.dia === d.key);
              return `
              <section class="svc-day ${d.key === hojeKey ? "is-today" : ""}" aria-label="${d.nome}">
                <h3>${d.nome}${d.key === hojeKey ? ' <span class="chip chip--soft">Hoje</span>' : ""}</h3>
                ${
                  doDia.length
                    ? doDia
                        .map(
                          (a) => `
                    <article class="svc-class">
                      <span class="svc-class__time">${esc(a.inicio)} – ${esc(a.fim)}</span>
                      <strong>${esc(a.turma.nome)}</strong>
                      <small>${esc(a.turma.codigo || "")}${a.prof ? ` · Prof. ${esc(a.prof)}` : ""}</small>
                    </article>`
                        )
                        .join("")
                    : '<p class="svc-free">Sem aulas</p>'
                }
              </section>`;
            })
            .join("")}
        </div>
        <div class="svc-footer">
          <p class="muted">${aulas.length} aula(s) por semana em ${turmasDoAluno(user.id).length} turma(s).</p>
          <button class="btn btn--filled" type="button" id="svcIcs">
            <span class="material-symbols-outlined" aria-hidden="true">event</span>
            Adicionar à minha agenda (.ics)
          </button>
        </div>`
        : `<div class="empty-state empty-state--compact">
            <div class="empty-state__icon" aria-hidden="true"><span class="material-symbols-outlined">event_busy</span></div>
            <h3>Nenhuma aula na grade</h3>
            <p>Quando a coordenação ou o professor te matricular numa turma, os horários aparecem aqui.</p>
          </div>`
    });

    body.querySelector("#svcIcs")?.addEventListener("click", () => baixarIcs(user, aulas));
  }

  function baixarIcs(user, aulas) {
    const pad = (n) => String(n).padStart(2, "0");
    const inicioSem = new Date(`${SEMESTRE.inicio}T00:00:00`);
    const fimSem = SEMESTRE.fim.replace(/-/g, "");
    const byday = { Seg: "MO", Ter: "TU", Qua: "WE", Qui: "TH", Sex: "FR", "Sáb": "SA" };
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const eventos = aulas.map((a, i) => {
      const alvo = DIAS.find((d) => d.key === a.dia).js;
      const dt = new Date(inicioSem);
      while (dt.getDay() !== alvo) dt.setDate(dt.getDate() + 1);
      const dia = `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
      const hi = a.inicio.replace(":", "") + "00";
      const hf = a.fim.replace(":", "") + "00";
      return [
        "BEGIN:VEVENT",
        `UID:${a.turma.id}-${a.dia}-${i}@portal-anchieta`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=America/Sao_Paulo:${dia}T${hi}`,
        `DTEND;TZID=America/Sao_Paulo:${dia}T${hf}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byday[a.dia]};UNTIL=${fimSem}T235959Z`,
        `SUMMARY:${a.turma.nome}`,
        `DESCRIPTION:Turma ${a.turma.codigo || ""}${a.prof ? ` · Prof. ${a.prof}` : ""} · Portal Anchieta`,
        "LOCATION:Centro Universitário Anchieta",
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Aula em 30 minutos",
        "END:VALARM",
        "END:VEVENT"
      ].join("\r\n");
    });
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Portal Anchieta//Grade de horarios//PT-BR",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Aulas · Portal Anchieta",
      "X-WR-TIMEZONE:America/Sao_Paulo",
      ...eventos,
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `grade-${SEMESTRE.nome}-${(user.ra || "aluno").replace(/\D/g, "")}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    snack("Grade baixada! Abra o arquivo para importar no Google Agenda ou Outlook.", { icon: "event", duration: 4200 });
  }

  /* ================= 3. DOCUMENTOS ================= */

  const DOCUMENTOS = [
    {
      id: "matricula",
      icon: "badge",
      nome: "Declaração de matrícula",
      desc: "Comprova o vínculo com o curso no semestre atual."
    },
    {
      id: "frequencia",
      icon: "event_available",
      nome: "Atestado de frequência",
      desc: "Aulas, faltas registradas e frequência por disciplina."
    },
    {
      id: "boletim",
      icon: "grade",
      nome: "Boletim parcial",
      desc: "Notas lançadas e média por disciplina até hoje."
    }
  ];

  function dadosAcademicos(user) {
    const notas = read("notas");
    const faltas = read("faltas");
    return turmasDoAluno(user.id).map((t) => {
      const ns = notas.filter((n) => n.turmaId === t.id && n.alunoId === user.id);
      const fs = faltas.filter((f) => f.turmaId === t.id && f.alunoId === user.id);
      const aulasPrevistas = 36;
      const freq = Math.max(0, Math.round(((aulasPrevistas - fs.length * 2) / aulasPrevistas) * 100));
      return { turma: t, notas: ns, media: media(ns), faltas: fs.length, freq };
    });
  }

  function gerarDocumento(id, user) {
    const curso = user.curso || user.extra?.curso || "Design de Interfaces";
    const dados = dadosAcademicos(user);
    const cod = codigoVerificacao(id, user.id, hojeISO());
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const assinatura = `
      <div class="sign">
        <div class="verify">Código de verificação: <strong class="mono">${cod}</strong><br>
        Emitido em ${new Date().toLocaleString("pt-BR")} pelo Portal Anchieta.</div>
        <div class="line">Secretaria Acadêmica<br>Centro Universitário Anchieta</div>
      </div>`;

    if (id === "matricula") {
      printWindow(
        "Declaração de matrícula",
        `<h1>Declaração de matrícula</h1>
        <p>Declaramos, para os devidos fins, que <strong>${esc(user.nome)}</strong>, RA <span class="mono">${esc(user.ra)}</span>,
        está regularmente matriculado(a) no curso de <strong>${esc(curso)}</strong> do Centro Universitário Anchieta,
        no semestre letivo <strong>${SEMESTRE.nome}</strong> (${fmtData(SEMESTRE.inicio)} a ${fmtData(SEMESTRE.fim)}),
        cursando as disciplinas abaixo.</p>
        <table><thead><tr><th>Disciplina</th><th>Turma</th><th>Horário</th></tr></thead><tbody>
        ${dados.map((d) => `<tr><td>${esc(d.turma.nome)}</td><td class="mono">${esc(d.turma.codigo || "")}</td><td>${esc(d.turma.horario || "")}</td></tr>`).join("") || '<tr><td colspan="3">Nenhuma disciplina vinculada.</td></tr>'}
        </tbody></table>
        <p>Jundiaí, ${hoje}.</p>${assinatura}`
      );
    } else if (id === "frequencia") {
      printWindow(
        "Atestado de frequência",
        `<h1>Atestado de frequência</h1>
        <p>Atestamos que <strong>${esc(user.nome)}</strong>, RA <span class="mono">${esc(user.ra)}</span>, aluno(a) do curso de
        <strong>${esc(curso)}</strong>, apresenta a seguinte frequência no semestre <strong>${SEMESTRE.nome}</strong>,
        conforme registros lançados pelos professores até ${hoje}.</p>
        <table><thead><tr><th>Disciplina</th><th>Faltas registradas</th><th>Frequência</th><th>Situação</th></tr></thead><tbody>
        ${dados
          .map(
            (d) =>
              `<tr><td>${esc(d.turma.nome)}</td><td>${d.faltas}</td><td>${d.freq}%</td><td>${d.freq >= 75 ? "Regular" : "Abaixo de 75%"}</td></tr>`
          )
          .join("") || '<tr><td colspan="4">Nenhuma disciplina vinculada.</td></tr>'}
        </tbody></table>
        <p>Frequência mínima exigida: 75% por disciplina.</p>${assinatura}`
      );
    } else {
      printWindow(
        "Boletim parcial",
        `<h1>Boletim parcial · ${SEMESTRE.nome}</h1>
        <p><strong>${esc(user.nome)}</strong> · RA <span class="mono">${esc(user.ra)}</span> · ${esc(curso)}</p>
        <table><thead><tr><th>Disciplina</th><th>Avaliações</th><th>Média</th><th>Situação</th></tr></thead><tbody>
        ${dados
          .map((d) => {
            const sit = d.media === null ? "Em andamento" : d.media >= 6 ? "Aprovado(a) parcial" : "Em recuperação";
            const av = d.notas.map((n) => `${esc(n.tipo)} ${fmtNota(n.valor)}`).join(" · ") || "—";
            return `<tr><td>${esc(d.turma.nome)}</td><td>${av}</td><td class="mono"><strong>${fmtNota(d.media)}</strong></td><td>${sit}</td></tr>`;
          })
          .join("") || '<tr><td colspan="4">Nenhuma disciplina vinculada.</td></tr>'}
        </tbody></table>
        <p>Média mínima para aprovação: 6,0. Boletim parcial, sujeito a alteração até o fechamento do semestre.</p>${assinatura}`
      );
    }
  }

  function openDocumentos() {
    const user = me();
    if (!user) return;
    const body = open({
      icon: "description",
      eyebrow: "Secretaria acadêmica · emissão na hora",
      title: "Documentos",
      html: `
        <div class="svc-docs">
          ${DOCUMENTOS.map(
            (d) => `
            <article class="svc-doc">
              <span class="svc-doc__icon material-symbols-outlined" aria-hidden="true">${d.icon}</span>
              <div>
                <strong>${d.nome}</strong>
                <small>${d.desc}</small>
              </div>
              <button class="btn btn--filled" type="button" data-doc="${d.id}">
                <span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>Gerar
              </button>
            </article>`
          ).join("")}
        </div>
        <p class="svc-note"><span class="material-symbols-outlined" aria-hidden="true">verified</span>
          Gerados com seus dados do banco (nome, RA, turmas, notas e faltas). Use “Imprimir / Salvar PDF” na janela que abrir.</p>`
    });
    body.querySelectorAll("[data-doc]").forEach((btn) =>
      btn.addEventListener("click", () => {
        gerarDocumento(btn.dataset.doc, user);
        snack("Documento gerado em uma nova aba.", { icon: "description" });
      })
    );
  }

  /* ================= 4. SUPORTE (chamados) ================= */

  const STATUS = {
    aberto: { label: "Aberto", chip: "chip chip--warning" },
    em_atendimento: { label: "Em atendimento", chip: "chip chip--soft" },
    resolvido: { label: "Resolvido", chip: "chip chip--success" }
  };

  function salvarChamados(lista) {
    localStorage.setItem(KEYS.chamados, JSON.stringify(lista)); // db.js envia ao banco
  }

  function chamadoItem(c, { admin = false } = {}) {
    const st = STATUS[c.status] || STATUS.aberto;
    const aluno = admin ? read("users").find((u) => u.id === c.alunoId) : null;
    return `
      <li class="svc-ticket" data-ticket="${esc(c.id)}">
        <div class="svc-ticket__head">
          <code>${esc(c.protocolo)}</code>
          <span class="${st.chip}">${st.label}</span>
        </div>
        <strong>${esc(c.assunto)}</strong>
        <small>${esc(c.categoria)} · ${new Date(c.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${
          aluno ? ` · ${esc(aluno.nome)} (RA ${esc(aluno.ra)})` : ""
        }</small>
        ${admin ? `<p>${esc(c.mensagem)}</p>` : ""}
        ${c.resposta ? `<p class="svc-ticket__reply"><span class="material-symbols-outlined" aria-hidden="true">reply</span>${esc(c.resposta)}</p>` : ""}
        ${
          admin && c.status !== "resolvido"
            ? `<div class="svc-ticket__actions">
                ${c.status === "aberto" ? `<button class="btn btn--tonal" type="button" data-ticket-status="em_atendimento">Assumir atendimento</button>` : ""}
                <button class="btn btn--filled" type="button" data-ticket-status="resolvido">Marcar como resolvido</button>
              </div>`
            : ""
        }
      </li>`;
  }

  function openSuporte() {
    const user = me();
    if (!user) return;
    const render = () => {
      const meus = read("chamados")
        .filter((c) => c.alunoId === user.id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return meus.length ? meus.map((c) => chamadoItem(c)).join("") : '<li class="muted svc-empty">Você ainda não abriu chamados.</li>';
    };

    const body = open({
      icon: "support_agent",
      eyebrow: "Central de atendimento",
      title: "Suporte",
      html: `
        <div class="svc-support">
          <form class="svc-form" id="svcTicketForm" novalidate>
            <label class="field">
              <span class="field__label">Assunto do atendimento</span>
              <select class="field__input" id="svcCategoria">
                <option>Financeiro</option>
                <option>Notas e avaliações</option>
                <option>Acesso ao portal</option>
                <option>Documentos</option>
                <option>Outro</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">Título</span>
              <input class="field__input" id="svcAssunto" maxlength="80" placeholder="Ex.: Nota da P1 não apareceu" />
              <span class="field__error" id="svcAssuntoErr" hidden>Escreva um título com pelo menos 5 letras.</span>
            </label>
            <label class="field">
              <span class="field__label">Descreva o que aconteceu</span>
              <textarea class="field__input" id="svcMensagem" maxlength="600" rows="4" placeholder="Conte os detalhes para a coordenação te ajudar mais rápido."></textarea>
              <span class="field__error" id="svcMensagemErr" hidden>Descreva com pelo menos 10 caracteres.</span>
            </label>
            <button class="btn btn--filled" type="submit" id="svcEnviar">
              <span class="material-symbols-outlined" aria-hidden="true">send</span>Abrir chamado
            </button>
            <p class="svc-note"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>
              Atendimento da coordenação: seg. a sex., 8h às 22h. Você acompanha o status aqui.</p>
          </form>
          <div class="svc-tickets">
            <h3>Meus chamados</h3>
            <ul class="svc-ticket-list" id="svcMeusChamados">${render()}</ul>
          </div>
        </div>`
    });

    const form = body.querySelector("#svcTicketForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const assunto = body.querySelector("#svcAssunto");
      const mensagem = body.querySelector("#svcMensagem");
      const okA = assunto.value.trim().length >= 5;
      const okM = mensagem.value.trim().length >= 10;
      body.querySelector("#svcAssuntoErr").hidden = okA;
      body.querySelector("#svcMensagemErr").hidden = okM;
      assunto.classList.toggle("is-invalid", !okA);
      mensagem.classList.toggle("is-invalid", !okM);
      if (!okA) return assunto.focus();
      if (!okM) return mensagem.focus();

      const lista = read("chamados");
      const seq = String(Date.now()).slice(-5);
      const chamado = {
        id: `c-${Date.now()}`,
        protocolo: `ANC-2026-${seq}`,
        alunoId: user.id,
        categoria: body.querySelector("#svcCategoria").value,
        assunto: assunto.value.trim(),
        mensagem: mensagem.value.trim(),
        status: "aberto",
        resposta: "",
        createdAt: new Date().toISOString()
      };
      lista.push(chamado);
      salvarChamados(lista);
      form.reset();
      body.querySelector("#svcMeusChamados").innerHTML = render();
      snack(`Chamado ${chamado.protocolo} aberto! A coordenação foi avisada.`, { icon: "support_agent", duration: 4200 });
    });
  }

  /* ---- Painel da coordenação: chamados recebidos ---- */

  function injectAdminPanel() {
    const view = document.getElementById("view-admin-home");
    if (!view || document.getElementById("svcAdminChamados")) return;
    const card = document.createElement("article");
    card.className = "card panel";
    card.id = "svcAdminChamados";
    card.innerHTML = `
      <div class="panel__head">
        <div><p class="eyebrow">Central de atendimento</p><h3>Chamados de suporte</h3></div>
        <span class="chip" id="svcAdminCount">0 abertos</span>
      </div>
      <ul class="svc-ticket-list svc-ticket-list--admin" id="svcAdminList"></ul>`;
    view.appendChild(card);
    card.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ticket-status]");
      if (!btn) return;
      const id = btn.closest("[data-ticket]").dataset.ticket;
      const lista = read("chamados");
      const c = lista.find((x) => x.id === id);
      if (!c) return;
      c.status = btn.dataset.ticketStatus;
      c.resposta =
        c.status === "resolvido"
          ? `Resolvido pela coordenação em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
          : "A coordenação está analisando seu pedido.";
      salvarChamados(lista);
      renderAdminPanel();
      snack(`Chamado ${c.protocolo}: ${STATUS[c.status].label.toLowerCase()}.`, { icon: "support_agent" });
    });
    renderAdminPanel();
  }

  function renderAdminPanel() {
    const list = document.getElementById("svcAdminList");
    if (!list) return;
    const ordem = { aberto: 0, em_atendimento: 1, resolvido: 2 };
    const todos = read("chamados").sort(
      (a, b) => (ordem[a.status] ?? 3) - (ordem[b.status] ?? 3) || String(b.createdAt).localeCompare(String(a.createdAt))
    );
    const abertos = todos.filter((c) => c.status !== "resolvido").length;
    document.getElementById("svcAdminCount").textContent = `${abertos} ${abertos === 1 ? "aberto" : "abertos"}`;
    list.innerHTML = todos.length
      ? todos.slice(0, 12).map((c) => chamadoItem(c, { admin: true })).join("")
      : '<li class="muted svc-empty">Nenhum chamado no momento. Quando um aluno pedir ajuda, aparece aqui em tempo real.</li>';
  }

  /* ---------------- Ligação com a interface ---------------- */

  const ACTIONS = {
    "segunda-via": openBoletos,
    grade: openGrade,
    documentos: openDocumentos,
    suporte: openSuporte
  };

  document.querySelectorAll(".quick-action[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => ACTIONS[btn.dataset.action]?.());
  });

  // Quando o banco atualiza (outra pessoa mexeu), atualiza o painel e a lista aberta
  if (window.ACADEMIC && typeof window.ACADEMIC.refreshAllFromStorage === "function") {
    const original = window.ACADEMIC.refreshAllFromStorage;
    window.ACADEMIC.refreshAllFromStorage = function (...args) {
      const r = original.apply(this, args);
      renderAdminPanel();
      const meus = document.getElementById("svcMeusChamados");
      const user = me();
      if (meus && user) {
        const lista = read("chamados")
          .filter((c) => c.alunoId === user.id)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        if (lista.length) meus.innerHTML = lista.map((c) => chamadoItem(c)).join("");
      }
      return r;
    };
  }

  injectAdminPanel();
  // Re-renderiza ao abrir o painel da coordenação
  const adminView = document.getElementById("view-admin-home");
  if (adminView) {
    new MutationObserver(() => adminView.classList.contains("is-active") && renderAdminPanel()).observe(adminView, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  window.SERVICOS = { openBoletos, openGrade, openDocumentos, openSuporte, parseHorario };
})();
