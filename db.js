/* ============================================================
   Portal Anchieta — db.js (cliente do banco de dados)
   ------------------------------------------------------------
   Arquitetura "cache local + servidor como fonte da verdade":

   1. Ao abrir, consulta /api/health. Com banco → baixa tudo de
      /api/state e grava no localStorage (cache). Sem banco →
      "modo local" (o portal funciona igual, só no navegador).
   2. Só então carrega academic.js, script.js, slides.js e effects.js.
   3. Toda gravação do portal no localStorage é comparada com a
      última versão do servidor; as diferenças viram um lote para
      POST /api/sync (com token de sessão).
   4. A cada 3 s busca /api/state?since=N: o que outra pessoa mudou
      aparece na tela sozinho (ex.: professor lança nota → aluno vê).
   5. Monta a tela "Banco de dados" (coordenação) e o indicador de
      conexão na barra superior.
   ============================================================ */

(() => {
  "use strict";

  const API = "api";
  const VERSION = "20261126-db";
  const SCRIPTS = ["academic.js", "script.js", "servicos.js", "slides.js", "effects.js"];
  const TOKEN_KEY = "educonnect-db-token";
  const SESSION_KEY = "educonnect-session-v2";
  const POLL_MS = 3000;

  const KEYS = {
    users: "educonnect-users-v2",
    turmas: "educonnect-turmas-v2",
    notas: "educonnect-notas-v1",
    atividades: "educonnect-atividades-v1",
    faltas: "educonnect-faltas-v1",
    provas: "educonnect-provas-v1",
    entregas: "educonnect-entregas-v1",
    chamados: "educonnect-chamados-v1"
  };
  const COLLECTION_BY_KEY = Object.fromEntries(Object.entries(KEYS).map(([c, k]) => [k, c]));
  const ORDER = ["users", "turmas", "atividades", "provas", "notas", "faltas", "entregas", "chamados"];

  const LABELS = {
    users: { nome: "Usuário", icon: "person" },
    turmas: { nome: "Turma", icon: "class" },
    notas: { nome: "Nota", icon: "grade" },
    provas: { nome: "Prova", icon: "quiz" },
    atividades: { nome: "Atividade", icon: "assignment" },
    faltas: { nome: "Falta", icon: "event_busy" },
    entregas: { nome: "Entrega", icon: "upload_file" },
    chamados: { nome: "Chamado", icon: "support_agent" },
    sistema: { nome: "Sistema", icon: "database" }
  };

  const rawSetItem = Storage.prototype.setItem;
  const rawRemoveItem = Storage.prototype.removeItem;
  const rawGetItem = Storage.prototype.getItem;

  /* Modo apresentação (slides "Antes × Depois"):
     index.html?demo=aluno|admin|professor&view=<tela>&focus=<seletor>&theme=light&dialog=delete
     → entra sozinho, mostra a tela real e fica SOMENTE LEITURA:
       não grava nada e não mexe na sessão/tema de quem está apresentando. */
  const PARAMS = new URLSearchParams(location.search);
  const DEMO = PARAMS.get("demo");
  if (DEMO) {
    document.documentElement.classList.add("is-demo");
    const demoStyle = document.createElement("style");
    demoStyle.textContent = ".is-demo .fab { display: none !important; }";
    document.head.appendChild(demoStyle);
    const isPortalKey = (k) => typeof k === "string" && k.startsWith("educonnect-");
    Storage.prototype.removeItem = function (key) {
      if (this === localStorage && isPortalKey(key)) return;
      return rawRemoveItem.call(this, key);
    };
    Storage.prototype.getItem = function (key) {
      if (this === localStorage && (key === "educonnect-session-v2" || key === "educonnect-db-token")) return null;
      return rawGetItem.call(this, key);
    };
  }

  const state = {
    online: false,
    status: "connecting", // connecting | online | syncing | offline | local
    info: null,
    seq: 0,
    token: DEMO ? "" : localStorage.getItem(TOKEN_KEY) || "",
    snapshots: {},
    dirty: new Set(),
    outbox: [],
    sending: false,
    applyingRemote: false,
    pendingRefresh: false,
    lastSyncAt: null,
    pollTimer: 0,
    flushTimer: 0
  };

  /* ---------------- Utilidades ---------------- */

  function me() {
    try {
      const body = state.token.split(".")[0];
      return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  }

  async function api(path, { method = "GET", body, timeout = 10000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = { Accept: "application/json" };
      if (body) headers["Content-Type"] = "application/json";
      if (state.token) headers.Authorization = `Bearer ${state.token}`;
      const res = await fetch(`${API}/${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller.signal
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = { ok: false, error: `Resposta inválida (${res.status})` };
      }
      return { status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  function snack(message, options) {
    if (typeof window.showSnackbar === "function") window.showSnackbar(message, options);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function timeAgo(iso) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const s = Math.round(diff / 1000);
    if (s < 10) return "agora";
    if (s < 60) return `há ${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `há ${h} h`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function readLocal(collection) {
    try {
      const arr = JSON.parse(localStorage.getItem(KEYS[collection]) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeLocal(collection, arr) {
    state.applyingRemote = true;
    try {
      rawSetItem.call(localStorage, KEYS[collection], JSON.stringify(arr));
    } finally {
      state.applyingRemote = false;
    }
  }

  function snapshotOf(arr) {
    const map = new Map();
    arr.forEach((item) => item && item.id && map.set(String(item.id), JSON.stringify(item)));
    return map;
  }

  /* ---------------- Status (chip na barra) ---------------- */

  function setStatus(status) {
    state.status = status;
    document.body.dataset.db = status;
    const text = {
      connecting: "Conectando…",
      online: state.info?.provider || "Banco online",
      syncing: "Salvando…",
      offline: "Sem conexão · tentando",
      local: "Modo local"
    }[status];
    document.querySelectorAll("[data-db-label]").forEach((el) => (el.textContent = text));
    document.querySelectorAll("[data-db-chip]").forEach((el) => {
      el.dataset.state = status;
      el.title =
        status === "local"
          ? "Sem banco de dados: os dados ficam só neste navegador."
          : status === "online"
            ? `Conectado ao ${state.info?.provider || "banco"} · sincronização em tempo real`
            : text;
    });
  }

  /* ---------------- Carga inicial ---------------- */

  function applyFull(payload) {
    ORDER.forEach((collection) => {
      const arr = payload.data?.[collection] || [];
      writeLocal(collection, arr);
      state.snapshots[collection] = snapshotOf(arr);
    });
    state.seq = Number(payload.seq) || 0;
    state.lastSyncAt = new Date();
  }

  async function boot() {
    setStatus("connecting");
    try {
      const health = await api("health", { timeout: 9000 });
      if (!health.data?.ok) throw new Error(health.data?.reason || "sem banco");
      state.info = health.data;
      const full = await api("state", { timeout: 12000 });
      if (!full.data?.ok) throw new Error(full.data?.error || "falha ao carregar");
      applyFull(full.data);
      state.online = true;

      // Sessão antiga sem token do servidor não vale no modo online
      if (!state.token || !me() || me().exp < Date.now()) {
        state.token = "";
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
      }
      setStatus("online");
    } catch (err) {
      state.online = false;
      setStatus("local");
      console.info("[db] modo local:", err.message);
    }
  }

  /* ---------------- Envio de alterações ---------------- */

  Storage.prototype.setItem = function (key, value) {
    if (DEMO && this === localStorage && String(key).startsWith("educonnect-")) return; // somente leitura
    rawSetItem.call(this, key, value);
    if (this !== localStorage || !state.online || state.applyingRemote) return;
    const collection = COLLECTION_BY_KEY[key];
    if (!collection) return;
    state.dirty.add(collection);
    clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(flushDirty, 120);
  };

  function flushDirty() {
    const collections = ORDER.filter((c) => state.dirty.has(c));
    state.dirty.clear();
    collections.forEach((collection) => {
      const arr = readLocal(collection);
      const before = state.snapshots[collection] || new Map();
      const after = snapshotOf(arr);
      after.forEach((json, id) => {
        if (before.get(id) !== json) {
          state.outbox.push({ collection, op: "upsert", id, item: JSON.parse(json) });
        }
      });
      before.forEach((_json, id) => {
        if (!after.has(id)) state.outbox.push({ collection, op: "delete", id });
      });
      state.snapshots[collection] = after;
    });
    sendOutbox();
  }

  async function sendOutbox() {
    if (state.sending || !state.outbox.length) return;
    if (!state.token) {
      // Alteração sem login (não deveria acontecer): descarta e volta ao estado do servidor
      state.outbox = [];
      return resync();
    }
    state.sending = true;
    const batch = state.outbox.splice(0, 200);
    setStatus("syncing");
    try {
      const { status, data } = await api("sync", { method: "POST", body: { changes: batch } });
      if (status === 401) {
        state.token = "";
        localStorage.removeItem(TOKEN_KEY);
        snack("Sua sessão expirou. Entre novamente.", { icon: "lock" });
        if (typeof window.logout === "function") window.logout();
        return;
      }
      if (data.seq) state.seq = Math.max(state.seq, Number(data.seq));
      if (data.rejected?.length) {
        snack(`Não foi salvo no banco: ${data.rejected[0].reason}`, { icon: "error", duration: 4200 });
        await resync();
      }
      state.lastSyncAt = new Date();
      setStatus("online");
      renderBancoLight();
    } catch {
      // Sem rede: devolve o lote para a fila e tenta de novo
      state.outbox.unshift(...batch);
      setStatus("offline");
      setTimeout(sendOutbox, 3000);
    } finally {
      state.sending = false;
      if (state.outbox.length && state.status !== "offline") sendOutbox();
    }
  }

  /* ---------------- Recebendo alterações de outras pessoas ---------------- */

  function refreshUi() {
    const active = document.activeElement;
    const typing =
      active &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) &&
      active.closest(".view, .dialog") &&
      active.type !== "checkbox";
    if (typing) {
      state.pendingRefresh = true;
      return;
    }
    state.pendingRefresh = false;
    try {
      if (window.ACADEMIC?.refreshAllFromStorage) window.ACADEMIC.refreshAllFromStorage();
      else if (typeof window.reloadEduUsers === "function") window.reloadEduUsers();
      // Telas da coordenação que não dependem do academic.js
      if (typeof window.renderUsersTable === "function") window.renderUsersTable();
      if (typeof window.updateAdminMetrics === "function") window.updateAdminMetrics();
    } catch (err) {
      console.warn("[db] refresh", err);
    }
  }

  document.addEventListener("focusout", () => {
    if (state.pendingRefresh) setTimeout(refreshUi, 150);
  });

  async function resync() {
    try {
      const { data } = await api("state");
      if (data?.ok) {
        applyFull(data);
        refreshUi();
      }
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }

  function describeEvent(ev) {
    const label = LABELS[ev.colecao]?.nome || "Registro";
    const verb = ev.operacao === "delete" ? "removeu" : ev.operacao === "reset" ? "restaurou" : "salvou";
    const who = ev.autor_nome ? ev.autor_nome.split(" ")[0] : "Alguém";
    if (ev.operacao === "reset") return `${who} restaurou o banco de demonstração`;
    return `${who} ${verb} ${label.toLowerCase()}${ev.resumo ? `: ${ev.resumo}` : ""}`;
  }

  async function poll() {
    clearTimeout(state.pollTimer);
    if (state.online && !document.hidden && !state.outbox.length && !state.sending) {
      try {
        const { data } = await api(`state?since=${state.seq}`, { timeout: 8000 });
        if (data?.ok) {
          if (data.full) {
            applyFull(data);
            refreshUi();
            if (data.reset) snack("O banco foi restaurado para a demonstração.", { icon: "database" });
          } else if (data.changes?.length) {
            let changed = false;
            const byCollection = {};
            data.changes.forEach((ch) => (byCollection[ch.collection] ||= []).push(ch));
            Object.entries(byCollection).forEach(([collection, list]) => {
              const arr = readLocal(collection);
              list.forEach((ch) => {
                const idx = arr.findIndex((i) => String(i.id) === String(ch.id));
                if (ch.op === "delete") {
                  if (idx >= 0) {
                    arr.splice(idx, 1);
                    changed = true;
                  }
                } else if (idx >= 0) {
                  if (JSON.stringify(arr[idx]) !== JSON.stringify(ch.item)) {
                    // Mantém campos locais que o servidor não devolve (ex.: senha recém-criada)
                    arr[idx] = { ...ch.item, ...(arr[idx].senha ? { senha: arr[idx].senha } : {}) };
                    changed = true;
                  }
                } else {
                  arr.push(ch.item);
                  changed = true;
                }
              });
              writeLocal(collection, arr);
              state.snapshots[collection] = snapshotOf(arr);
            });
            state.seq = Math.max(state.seq, Number(data.seq) || 0);
            if (changed) {
              refreshUi();
              const mine = me()?.sub;
              const foreign = (data.events || []).find((ev) => ev.autor_id && ev.autor_id !== mine);
              if (foreign && document.body.classList.contains("is-authenticated")) {
                snack(describeEvent(foreign), { icon: LABELS[foreign.colecao]?.icon || "sync", duration: 3600 });
              }
            }
          } else {
            state.seq = Math.max(state.seq, Number(data.seq) || 0);
          }
          state.lastSyncAt = new Date();
          if (state.status !== "online") setStatus("online");
          renderBancoLight();
        }
      } catch {
        setStatus("offline");
      }
    }
    state.pollTimer = setTimeout(poll, POLL_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.online) poll();
  });

  /* ---------------- Login / logout (usados pelo script.js) ---------------- */

  async function login(identifier, senha) {
    try {
      const { data } = await api("login", { method: "POST", body: { identifier, senha } });
      if (!data?.ok) return { ok: false, error: data?.error || "Não foi possível entrar." };
      state.token = data.token;
      rawSetItem.call(localStorage, TOKEN_KEY, data.token);
      // Garante que o usuário está no cache local
      const users = readLocal("users");
      if (!users.some((u) => u.id === data.user.id)) {
        users.push(data.user);
        writeLocal("users", users);
        state.snapshots.users = snapshotOf(users);
      }
      return { ok: true, user: data.user };
    } catch {
      return { ok: false, error: "Sem conexão com o servidor. Tente de novo." };
    }
  }

  function logoutDb() {
    state.token = "";
    localStorage.removeItem(TOKEN_KEY);
  }

  /* ---------------- Interface: indicador + tela "Banco de dados" ---------------- */

  function injectUi() {
    // Indicador na barra superior
    const end = document.querySelector(".app-bar__end");
    if (end && !end.querySelector("[data-db-chip]")) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "db-chip";
      chip.setAttribute("data-db-chip", "");
      chip.innerHTML =
        '<span class="db-chip__dot" aria-hidden="true"></span><span class="db-chip__text" data-db-label>Conectando…</span>';
      chip.addEventListener("click", () => {
        const navBanco = document.querySelector('.nav-item[data-view="banco"]')?.closest("li");
        const role = me()?.role || (navBanco && !navBanco.hidden ? "admin" : "");
        if (typeof window.setActiveView === "function" && document.body.classList.contains("is-authenticated")) {
          if (role === "admin") window.setActiveView("banco");
          else
            snack(
              state.online
                ? `Dados salvos no ${state.info?.provider || "banco"} e sincronizados em tempo real.`
                : "Modo local: os dados ficam só neste navegador.",
              { icon: "database" }
            );
        }
      });
      end.prepend(chip);
    }

    // Linha de status no login
    const panel = document.querySelector(".login-demos");
    if (panel && !panel.querySelector(".db-login")) {
      const line = document.createElement("p");
      line.className = "db-login";
      line.setAttribute("data-db-chip", "");
      line.innerHTML = '<span class="db-chip__dot" aria-hidden="true"></span><span data-db-label>Conectando…</span>';
      panel.appendChild(line);
    }

    // Item no menu (coordenação)
    const usuariosItem = document.querySelector('.nav-item[data-view="admin-turmas"]')?.closest("li");
    if (usuariosItem && !document.querySelector('.nav-item[data-view="banco"]')) {
      const li = document.createElement("li");
      li.setAttribute("data-roles", "admin");
      li.innerHTML = `
        <button class="nav-item" type="button" data-view="banco">
          <span class="material-symbols-outlined" aria-hidden="true">database</span>
          <span>Banco de dados</span>
          <span class="chip chip--soft db-nav-chip" data-db-chip><span class="db-chip__dot" aria-hidden="true"></span></span>
        </button>`;
      usuariosItem.after(li);
    }

    // Tela "Banco de dados"
    const content = document.getElementById("conteudo-principal");
    if (content && !document.getElementById("view-banco")) {
      const section = document.createElement("section");
      section.className = "view";
      section.id = "view-banco";
      section.hidden = true;
      section.setAttribute("data-roles", "admin");
      section.setAttribute("data-title", "Banco de dados");
      section.setAttribute("aria-labelledby", "banco-heading");
      section.innerHTML = `
        <header class="page-intro">
          <div>
            <h2 id="banco-heading" class="display-title">Banco de dados</h2>
            <p class="lede">Tudo o que é lançado no portal fica gravado num <strong>PostgreSQL</strong> na nuvem
              e aparece para todo mundo em tempo real.</p>
          </div>
          <div class="page-intro__actions">
            <button class="btn btn--tonal" type="button" id="bancoRefresh">
              <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
              Atualizar
            </button>
          </div>
        </header>

        <article class="card campus-hero db-hero">
          <span class="campus-hero__orb campus-hero__orb--1" aria-hidden="true"></span>
          <span class="campus-hero__orb campus-hero__orb--2" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">Conexão</p>
            <h3 id="bancoProvider">Verificando…</h3>
            <p id="bancoDesc">Consultando o servidor.</p>
          </div>
          <dl class="db-stats" id="bancoStats" aria-live="polite"></dl>
        </article>

        <div class="split-grid">
          <article class="card panel">
            <div class="panel__head">
              <div><p class="eyebrow">Tabelas</p><h3>Registros por tabela</h3></div>
              <span class="chip" id="bancoTotal">—</span>
            </div>
            <div class="db-tables" id="bancoTables"></div>
          </article>

          <article class="card panel">
            <div class="panel__head">
              <div><p class="eyebrow">Auditoria · tempo real</p><h3>Últimas alterações</h3></div>
              <span class="chip chip--success db-live"><span class="db-chip__dot" aria-hidden="true"></span>Ao vivo</span>
            </div>
            <ul class="db-log" id="bancoLog"></ul>
          </article>
        </div>

        <article class="card panel">
          <div class="panel__head">
            <div><p class="eyebrow">SQL VIEW · vw_boletim</p><h3>Boletim calculado pelo banco</h3></div>
            <span class="chip">AVG(notas) + COUNT(faltas) por aluno e turma</span>
          </div>
          <div class="table-wrap">
            <table class="audit-table db-boletim">
              <thead><tr><th>RA</th><th>Aluno</th><th>Turma</th><th>Média</th><th>Notas</th><th>Faltas</th></tr></thead>
              <tbody id="bancoBoletim"></tbody>
            </table>
          </div>
        </article>

        <article class="card panel">
          <div class="panel__head">
            <div><p class="eyebrow">Arquitetura</p><h3>Como os dados viajam</h3></div>
          </div>
          <ol class="db-flow">
            <li><span class="material-symbols-outlined" aria-hidden="true">touch_app</span><strong>Portal</strong><small>HTML + CSS + JS (Material/Aurora)</small></li>
            <li><span class="material-symbols-outlined" aria-hidden="true">api</span><strong>API</strong><small>Vercel Functions · /api/login, /api/sync, /api/state</small></li>
            <li><span class="material-symbols-outlined" aria-hidden="true">lock</span><strong>Segurança</strong><small>Senha com bcrypt · token assinado · permissão por cargo</small></li>
            <li><span class="material-symbols-outlined" aria-hidden="true">database</span><strong>PostgreSQL</strong><small>10 tabelas relacionais com chaves estrangeiras + log de auditoria</small></li>
          </ol>
        </article>

        <article class="card panel db-danger">
          <div class="panel__head">
            <div><p class="eyebrow">Manutenção</p><h3>Restaurar dados de demonstração</h3></div>
          </div>
          <p>Apaga o que foi lançado nos testes e grava de novo os usuários, turmas, notas e provas de demonstração
            (a PROVA P2 volta para a data de hoje).</p>
          <button class="btn btn--danger" type="button" id="bancoReset" data-reset-db>
            <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
            Restaurar banco
          </button>
        </article>`;
      content.appendChild(section);
    }
  }

  let bancoBusy = false;
  let lastStatsAt = 0;

  async function renderBanco() {
    const view = document.getElementById("view-banco");
    if (!view || bancoBusy) return;
    const provider = document.getElementById("bancoProvider");
    const desc = document.getElementById("bancoDesc");
    const stats = document.getElementById("bancoStats");

    if (!state.online) {
      provider.textContent = "Modo local (sem banco conectado)";
      desc.innerHTML =
        "Os dados estão só neste navegador. Para ativar o banco: na Vercel, aba <strong>Storage</strong> → <strong>Neon</strong> → conectar ao projeto e fazer um novo deploy.";
      stats.innerHTML = "";
      document.getElementById("bancoTables").innerHTML = '<p class="muted">Sem banco conectado.</p>';
      document.getElementById("bancoLog").innerHTML = "";
      document.getElementById("bancoBoletim").innerHTML = "";
      return;
    }

    bancoBusy = true;
    try {
      const { status, data } = await api("stats");
      if (status !== 200 || !data.ok) throw new Error(data.error || "Falha ao consultar");
      lastStatsAt = Date.now();
      provider.textContent = `${data.provider} · conectado`;
      desc.textContent = `Banco "${data.banco}" respondendo em ${data.latencyMs} ms. Sincronização automática a cada ${POLL_MS / 1000} s.`;
      stats.innerHTML = [
        ["Versão", `PostgreSQL ${escapeHtml(data.versao)}`],
        ["Latência", `${data.latencyMs} ms`],
        ["Tamanho", escapeHtml(data.tamanho)],
        ["Alteração nº", String(state.seq)]
      ]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
        .join("");

      const total = data.tables.reduce((sum, t) => sum + t.linhas, 0);
      document.getElementById("bancoTotal").textContent = `${total} registros`;
      document.getElementById("bancoTables").innerHTML = data.tables
        .map(
          (t) => `
          <div class="db-table">
            <code>${escapeHtml(t.tabela)}</code>
            <span>${escapeHtml(t.label)}</span>
            <strong>${t.linhas}</strong>
          </div>`
        )
        .join("");

      document.getElementById("bancoLog").innerHTML =
        data.log
          .map((ev) => {
            const meta = LABELS[ev.colecao] || LABELS.sistema;
            const tone = ev.operacao === "delete" ? "delete" : ev.operacao === "reset" ? "reset" : "upsert";
            return `
            <li class="db-log__item db-log__item--${tone}">
              <span class="db-log__icon material-symbols-outlined" aria-hidden="true">${meta.icon}</span>
              <div>
                <strong>${escapeHtml(describeEvent(ev))}</strong>
                <small><code>${escapeHtml(ev.colecao)}</code> · #${ev.seq} · ${timeAgo(ev.em)}</small>
              </div>
            </li>`;
          })
          .join("") || '<li class="muted">Nenhuma alteração ainda.</li>';

      const fmt = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(1).replace(".", ","));
      document.getElementById("bancoBoletim").innerHTML =
        data.boletim
          .map((b) => {
            const media = b.media === null ? null : Number(b.media);
            const chip =
              media === null ? "chip" : media >= 6 ? "chip chip--success" : media >= 4 ? "chip chip--warning" : "chip chip--error";
            return `<tr><td><code>${escapeHtml(b.ra)}</code></td><td>${escapeHtml(b.aluno)}</td><td>${escapeHtml(
              b.turma
            )}</td><td><span class="${chip}">${fmt(media)}</span></td><td>${b.qtd_notas}</td><td>${b.faltas}</td></tr>`;
          })
          .join("") || '<tr><td colspan="6" class="muted">Sem matrículas.</td></tr>';
    } catch (err) {
      provider.textContent = "Não foi possível consultar o banco";
      desc.textContent = err.message;
    } finally {
      bancoBusy = false;
    }
  }

  // Atualização leve: só re-renderiza se a tela está aberta e já passou um tempinho
  function renderBancoLight() {
    const view = document.getElementById("view-banco");
    if (view && view.classList.contains("is-active") && Date.now() - lastStatsAt > 2500) renderBanco();
  }

  function bindBancoUi() {
    document.getElementById("bancoRefresh")?.addEventListener("click", renderBanco);
    document.getElementById("bancoReset")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const { status, data } = await api("reset", { method: "POST", timeout: 20000 });
        if (status !== 200 || !data.ok) throw new Error(data.error || "Falha ao restaurar");
        await resync();
        snack("Banco restaurado para os dados de demonstração.", { icon: "database" });
        renderBanco();
      } catch (err) {
        snack(err.message || "Não foi possível restaurar.", { icon: "error" });
      } finally {
        button.disabled = false;
      }
    });

    // Abre a tela → consulta o banco
    const view = document.getElementById("view-banco");
    if (view) {
      new MutationObserver(() => {
        if (view.classList.contains("is-active")) renderBanco();
      }).observe(view, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* ---------------- Modo apresentação ---------------- */

  function runDemo() {
    const ids = { aluno: "u-aluno", admin: "u-admin", professor: "u-prof" };
    const users = readLocal("users");
    const user = users.find((u) => u.id === ids[DEMO]) || users.find((u) => u.role === DEMO);
    if (!user || typeof window.enterApp !== "function") return;

    const hideSnack = () => document.getElementById("snackbar")?.classList.remove("is-open");
    window.enterApp(user);
    hideSnack();

    const theme = PARAMS.get("theme");
    if (theme && typeof window.applyTheme === "function") window.applyTheme(theme);

    const view = PARAMS.get("view");
    if (view && typeof window.setActiveView === "function") window.setActiveView(view);

    setTimeout(() => {
      hideSnack();
      const focus = PARAMS.get("focus");
      if (focus) document.querySelector(focus)?.scrollIntoView({ block: "center" });
      else window.scrollTo(0, 0);
      if (PARAMS.get("dialog") === "delete") {
        // Abre a confirmação real de exclusão (nada é apagado: a página está em modo leitura)
        document.querySelector(".view.is-active [data-remove-user], .view.is-active [data-unlink-aluno]")?.click();
      }
    }, 450);
  }

  /* ---------------- Carregamento dos scripts do portal ---------------- */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${src}?v=${VERSION}`;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.body.appendChild(s);
    });
  }

  // Bloqueia envio do login antes do portal carregar (evita senha na URL)
  document.getElementById("loginForm")?.addEventListener("submit", (e) => e.preventDefault());

  window.EDU_DB = {
    get online() {
      return state.online;
    },
    get status() {
      return state.status;
    },
    get info() {
      return state.info;
    },
    login,
    logout: logoutDb,
    resync,
    refreshBanco: renderBanco
  };

  injectUi();

  boot().finally(async () => {
    for (const src of SCRIPTS) {
      try {
        await loadScript(src);
      } catch (err) {
        console.error(err);
      }
    }
    bindBancoUi();
    setStatus(state.status);
    if (state.online) state.pollTimer = setTimeout(poll, POLL_MS);
    if (DEMO) runDemo();
  });
})();
