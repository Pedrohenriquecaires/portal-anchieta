/* ============================================================
   Portal Anchieta — Fluxo acadêmico dinâmico
   Admin cria turma → Professor vincula aluno → notas/atividades/faltas
   ============================================================ */

"use strict";

const ACADEMIC = (() => {
  const TURMAS_KEY = "educonnect-turmas-v2";
  const NOTAS_KEY = "educonnect-notas-v1";
  const ATIVIDADES_KEY = "educonnect-atividades-v1";
  const FALTAS_KEY = "educonnect-faltas-v1";
  const PROVAS_KEY = "educonnect-provas-v1";
  const ENTREGAS_KEY = "educonnect-entregas-v1";
  const DEMO_SEED_KEY = "educonnect-demo-seed-v5";
  const APP_VERSION_KEY = "educonnect-app-version";
  const APP_VERSION = "2026.11.26-p2";

  let turmas = [];
  let notas = [];
  let atividades = [];
  let faltas = [];
  let provas = [];
  let entregas = [];

  function load(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function migrateTurmas() {
    const v2 = load(TURMAS_KEY, null);
    if (v2 && v2.length) return v2.map(normalizeTurma);

    const legacy = load("educonnect-turmas-v1", []);
    const migrated = legacy.map(normalizeTurma);
    save(TURMAS_KEY, migrated);
    return migrated;
  }

  function normalizeTurma(turma) {
    const professorId = turma.professorId != null ? String(turma.professorId) : "";
    const professorRa = turma.professorRa != null ? String(turma.professorRa) : "";
    return {
      id: turma.id,
      nome: turma.nome,
      codigo: turma.codigo,
      professorId,
      professorRa,
      professorNome: turma.professorNome || "",
      horario: turma.horario || "",
      alunosIds: Array.isArray(turma.alunosIds) ? turma.alunosIds.map(String) : []
    };
  }

  function resolveProfessor(ref) {
    if (ref == null || ref === "") return null;
    const raw = String(ref).trim();
    const list = getUsers();
    const byId = list.find((u) => u.role === "professor" && String(u.id) === raw);
    if (byId) return byId;
    const ra = onlyDigitsSafe(raw);
    if (!ra) return null;
    return (
      list.find((u) => u.role === "professor" && onlyDigitsSafe(u.ra) === ra) || null
    );
  }

  function onlyDigitsSafe(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function turmaBelongsToProfessor(turma, professorId) {
    if (!turma || professorId == null || professorId === "") return false;
    const pid = String(professorId);
    if (String(turma.professorId || "") === pid) return true;

    const professor = findUser(pid) || resolveProfessor(pid);
    if (!professor || professor.role !== "professor") return false;

    if (turma.professorId && String(turma.professorId) === String(professor.id)) return true;

    const turmaRa = onlyDigitsSafe(turma.professorRa);
    const profRa = onlyDigitsSafe(professor.ra);
    if (turmaRa && profRa && turmaRa === profRa) return true;

    return false;
  }

  function repairTurmaProfessor(turma) {
    const prof =
      resolveProfessor(turma.professorId) ||
      resolveProfessor(turma.professorRa) ||
      null;
    if (!prof) return turma;
    return {
      ...turma,
      professorId: String(prof.id),
      professorRa: onlyDigitsSafe(prof.ra),
      professorNome: prof.nome || turma.professorNome || ""
    };
  }

  function migrateAppVersion() {
    if (window.EDU_DB && window.EDU_DB.online) return; // dados vêm do banco
    const current = localStorage.getItem(APP_VERSION_KEY);
    if (current === APP_VERSION) return;
    // Nova versão da entrega: reconstrói o pacote demo acadêmico
    localStorage.removeItem(DEMO_SEED_KEY);
    localStorage.removeItem(TURMAS_KEY);
    localStorage.removeItem(NOTAS_KEY);
    localStorage.removeItem(ATIVIDADES_KEY);
    localStorage.removeItem(FALTAS_KEY);
    localStorage.removeItem(PROVAS_KEY);
    localStorage.removeItem(ENTREGAS_KEY);
    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  }

  function init() {
    migrateAppVersion();
    turmas = migrateTurmas().map(repairTurmaProfessor);
    notas = load(NOTAS_KEY);
    atividades = load(ATIVIDADES_KEY);
    faltas = load(FALTAS_KEY);
    provas = load(PROVAS_KEY);
    entregas = load(ENTREGAS_KEY);
    persistTurmasQuiet();
    ensureDemoSeed();
  }

  /** Relê tudo do localStorage — evita tela desatualizada entre abas/sessões. */
  function reloadFromStorage() {
    turmas = load(TURMAS_KEY).map(normalizeTurma).map(repairTurmaProfessor);
    notas = load(NOTAS_KEY);
    atividades = load(ATIVIDADES_KEY);
    faltas = load(FALTAS_KEY);
    provas = load(PROVAS_KEY);
    entregas = load(ENTREGAS_KEY);
  }

  function ensureDemoSeed() {
    if (window.EDU_DB && window.EDU_DB.online) return; // o banco já tem os dados de demonstração
    const hasDemo = turmas.some((t) => t.id === "t-demo-mdf");
    if (hasDemo || turmas.length) {
      localStorage.setItem(DEMO_SEED_KEY, "1");
      return;
    }

    const professorId = "u-prof";
    const alunoId = "u-aluno";
    const aluno2Id = "u-aluno-2";

    // Segundo aluno demo — só altera se a lista de usuários já existir
    try {
      const rawUsers = localStorage.getItem("educonnect-users-v2");
      if (rawUsers) {
        const list = JSON.parse(rawUsers);
        let removedSeeds = [];
        try {
          removedSeeds = JSON.parse(localStorage.getItem("educonnect-removed-seeds") || "[]");
        } catch {
          removedSeeds = [];
        }
        if (
          Array.isArray(list) &&
          list.length &&
          !removedSeeds.includes(aluno2Id) &&
          !list.some((u) => u.id === aluno2Id)
        ) {
          list.push({
            id: aluno2Id,
            nome: "Pedro Caires",
            login: "",
            ra: "2505471",
            cpf: "46201414886",
            senha: "46201414886",
            email: "pedro.caires@anchieta.edu.br",
            telefone: "",
            role: "aluno",
            meta: "RA 2505471",
            locked: false
          });
          localStorage.setItem("educonnect-users-v2", JSON.stringify(list));
          if (typeof window.reloadEduUsers === "function") window.reloadEduUsers();
        }
      }
    } catch {
      /* ignore */
    }

    const t1 = {
      id: "t-demo-mdf",
      nome: "Material Design Framework",
      codigo: "MDF-A",
      professorId,
      professorRa: "230526",
      professorNome: "Daniel Feitoza",
      horario: "Seg/Qua 19:00–20:40",
      alunosIds: [alunoId, aluno2Id, "u-aluno-3", "u-aluno-4", "u-aluno-5", "u-aluno-6", "u-aluno-7"]
    };
    const t2 = {
      id: "t-demo-ux",
      nome: "UX Research e Prototipação",
      codigo: "UXR-B",
      professorId,
      professorRa: "230526",
      professorNome: "Daniel Feitoza",
      horario: "Ter/Qui 21:00–22:40",
      alunosIds: [alunoId, aluno2Id, "u-aluno-3", "u-aluno-4"]
    };

    turmas = [t1, t2];
    notas = [
      {
        id: "n-demo-1",
        turmaId: t1.id,
        alunoId,
        valor: 8.5,
        tipo: "P1",
        observacao: "Prova parcial — boa aplicação dos tokens",
        professorId,
        createdAt: "2026-09-15T20:00:00.000Z"
      },
      {
        id: "n-demo-2",
        turmaId: t1.id,
        alunoId,
        valor: 9.0,
        tipo: "Trabalho",
        observacao: "Entrega do redesign do dashboard",
        professorId,
        createdAt: "2026-10-10T20:00:00.000Z"
      },
      {
        id: "n-demo-3",
        turmaId: t1.id,
        alunoId,
        valor: 7.5,
        tipo: "Atividade",
        observacao: "Quiz de componentes Material",
        professorId,
        createdAt: "2026-10-20T20:00:00.000Z"
      },
      {
        id: "n-demo-4",
        turmaId: t2.id,
        alunoId,
        valor: 8.0,
        tipo: "P1",
        observacao: "Entrevista e mapa de empatia",
        professorId,
        createdAt: "2026-09-22T21:00:00.000Z"
      },
      {
        id: "n-demo-5",
        turmaId: t1.id,
        alunoId: aluno2Id,
        valor: 7.0,
        tipo: "P1",
        observacao: "",
        professorId,
        createdAt: "2026-09-15T20:00:00.000Z"
      }
    ];
    atividades = [
      {
        id: "a-demo-1",
        turmaId: t1.id,
        titulo: "Auditoria UX da tela original",
        descricao: "Liste 5 problemas de interface com evidência, impacto e solução Material.",
        prazo: "2026-11-25",
        tipo: "atividade",
        professorId,
        createdAt: "2026-11-01T12:00:00.000Z"
      },
      {
        id: "a-demo-2",
        turmaId: t1.id,
        titulo: "Protótipo mobile 360px",
        descricao: "Entregue o wireframe e o HTML responsivo da home do aluno.",
        prazo: "2026-12-05",
        tipo: "atividade",
        professorId,
        createdAt: "2026-11-10T12:00:00.000Z"
      },
      {
        id: "a-demo-3",
        turmaId: t2.id,
        titulo: "Roteiro de teste com usuário",
        descricao: "Prepare 5 tarefas e métricas de sucesso para o portal acadêmico.",
        prazo: "2026-11-28",
        tipo: "atividade",
        professorId,
        createdAt: "2026-11-08T12:00:00.000Z"
      }
    ];
    provas = [
      {
        id: "p-demo-1",
        turmaId: t1.id,
        titulo: "P1 — Fundamentos Material Design",
        descricao: "Componentes, hierarquia visual, tokens e estados de interface.",
        data: "2026-10-01",
        peso: 4,
        status: "aplicada",
        professorId,
        createdAt: "2026-08-20T12:00:00.000Z"
      },
      {
        id: "p-demo-2",
        turmaId: t1.id,
        titulo: "PROVA P2 - APRESENTAÇÃO PROJETO",
        descricao: "Apresentação do projeto final: redesign do portal com Material Design.",
        data: new Date().toLocaleDateString("sv-SE"), // data de hoje (AAAA-MM-DD, fuso local)
        peso: 4,
        status: "agendada",
        professorId,
        createdAt: new Date().toISOString()
      },
      {
        id: "p-demo-3",
        turmaId: t2.id,
        titulo: "P1 — Métodos de pesquisa",
        descricao: "Entrevistas, personas e jornada do usuário.",
        data: "2026-09-22",
        peso: 3,
        status: "aplicada",
        professorId,
        createdAt: "2026-08-25T12:00:00.000Z"
      }
    ];
    faltas = [
      {
        id: "f-demo-1",
        turmaId: t1.id,
        alunoId,
        data: "2026-10-06",
        motivo: "Atraso justificado",
        professorId,
        createdAt: "2026-10-06T22:00:00.000Z"
      }
    ];
    entregas = [
      {
        id: "e-demo-1",
        atividadeId: "a-demo-1",
        alunoId,
        texto: "Enviei a tabela com 5 problemas e prints do antes/depois.",
        createdAt: "2026-11-12T18:30:00.000Z"
      }
    ];

    persistTurmasQuiet();
    save(NOTAS_KEY, notas);
    save(ATIVIDADES_KEY, atividades);
    save(FALTAS_KEY, faltas);
    save(PROVAS_KEY, provas);
    save(ENTREGAS_KEY, entregas);
    localStorage.setItem(DEMO_SEED_KEY, "1");
  }

  function persistTurmasQuiet() {
    save(TURMAS_KEY, turmas);
  }

  function persistTurmas() {
    save(TURMAS_KEY, turmas);
    notifyDataChanged(TURMAS_KEY);
  }
  function persistNotas() {
    save(NOTAS_KEY, notas);
    notifyDataChanged(NOTAS_KEY);
  }
  function persistAtividades() {
    save(ATIVIDADES_KEY, atividades);
    notifyDataChanged(ATIVIDADES_KEY);
  }
  function persistFaltas() {
    save(FALTAS_KEY, faltas);
    notifyDataChanged(FALTAS_KEY);
  }
  function persistProvas() {
    save(PROVAS_KEY, provas);
    notifyDataChanged(PROVAS_KEY);
  }
  function persistEntregas() {
    save(ENTREGAS_KEY, entregas);
    notifyDataChanged(ENTREGAS_KEY);
  }

  const ACADEMIC_KEYS = new Set([
    TURMAS_KEY,
    NOTAS_KEY,
    ATIVIDADES_KEY,
    FALTAS_KEY,
    PROVAS_KEY,
    ENTREGAS_KEY
  ]);
  let syncChannel = null;
  let applyingRemoteSync = false;

  function notifyDataChanged(key) {
    if (applyingRemoteSync) return;
    try {
      if (!syncChannel) {
        syncChannel = new BroadcastChannel("educonnect-academic");
      }
      syncChannel.postMessage({ type: "academic-updated", key, at: Date.now() });
    } catch {
      /* BroadcastChannel pode não existir em alguns contextos */
    }
  }

  function handleRemoteSync() {
    if (applyingRemoteSync) return;
    applyingRemoteSync = true;
    try {
      refreshAllFromStorage();
    } finally {
      applyingRemoteSync = false;
    }
  }

  function bindLiveSync() {
    window.addEventListener("storage", (event) => {
      if (!event.key || !ACADEMIC_KEYS.has(event.key)) return;
      handleRemoteSync();
    });

    try {
      syncChannel = new BroadcastChannel("educonnect-academic");
      syncChannel.addEventListener("message", (event) => {
        if (!event?.data || event.data.type !== "academic-updated") return;
        handleRemoteSync();
      });
    } catch {
      /* ignore */
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      refreshAllFromStorage();
    });
  }

  function getUsers() {
    return typeof users !== "undefined" ? users : [];
  }

  /* RA e nome em colunas separadas */
  function alunoRa(id) {
    const u = findUser(id);
    return u && u.ra ? u.ra : "—";
  }

  function alunoNome(id) {
    const u = findUser(id);
    return u ? u.nome : "—";
  }

  function mediaChip(media) {
    if (media === null || media === undefined || Number.isNaN(media)) return '<span class="chip">—</span>';
    const tone = media >= 6 ? "chip--success" : media >= 4 ? "chip--warning" : "chip--error";
    return `<span class="chip ${tone}">${formatNota(media)}</span>`;
  }

  // Carrega o CSS das tabelas de alunos (colunas fixas: RA | Nome | ...)
  if (!document.querySelector('link[href^="tabelas.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "tabelas.css?v=20261126";
    document.head.appendChild(link);
  }

  function findUser(id) {
    return getUsers().find((u) => u.id === id) || null;
  }

  function userLabel(id) {
    const user = findUser(id);
    if (!user) return "—";
    return user.ra ? `${user.nome} · RA ${user.ra}` : user.nome;
  }

  function getTurmasDoProfessor(professorId) {
    return turmas.filter((t) => turmaBelongsToProfessor(t, professorId));
  }

  function getTurmasDoAluno(alunoId) {
    return turmas.filter((t) => t.alunosIds.includes(alunoId));
  }

  function countAlunosProfessor(professorId) {
    const ids = new Set();
    getTurmasDoProfessor(professorId).forEach((t) => {
      t.alunosIds.forEach((id) => ids.add(id));
    });
    return ids.size;
  }

  function mediaAluno(alunoId) {
    const lista = notas.filter((n) => n.alunoId === alunoId);
    if (!lista.length) return null;
    const soma = lista.reduce((acc, n) => acc + Number(n.valor), 0);
    return soma / lista.length;
  }

  function mediaTurmaAluno(turmaId, alunoId) {
    const lista = notas.filter((n) => n.turmaId === turmaId && n.alunoId === alunoId);
    if (!lista.length) return null;
    return lista.reduce((acc, n) => acc + Number(n.valor), 0) / lista.length;
  }

  function formatNota(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return Number(value).toFixed(1).replace(".", ",");
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ---------- Admin turmas ---------- */

  function createTurma({ nome, codigo, professorId, horario }) {
    const professor = resolveProfessor(professorId);
    if (!professor) {
      throw new Error("Professor inválido para vínculo da turma.");
    }

    const turma = {
      id: `t-${Date.now()}`,
      nome,
      codigo,
      professorId: String(professor.id),
      professorRa: onlyDigitsSafe(professor.ra),
      professorNome: professor.nome || "",
      horario: horario || "",
      alunosIds: []
    };
    turmas.push(turma);
    persistTurmas();
    return turma;
  }

  function removeTurma(id) {
    turmas = turmas.filter((t) => t.id !== id);
    notas = notas.filter((n) => n.turmaId !== id);
    atividades = atividades.filter((a) => a.turmaId !== id);
    faltas = faltas.filter((f) => f.turmaId !== id);
    persistTurmas();
    persistNotas();
    persistAtividades();
    persistFaltas();
  }

  function matricularAluno(turmaId, alunoId) {
    const turma = turmas.find((t) => t.id === turmaId);
    if (!turma) return { ok: false, message: "Turma não encontrada." };
    if (turma.alunosIds.includes(alunoId)) {
      return { ok: false, message: "Aluno já está nesta turma." };
    }
    const aluno = findUser(alunoId);
    if (!aluno || aluno.role !== "aluno") {
      return { ok: false, message: "Selecione um aluno válido do cadastro." };
    }
    turma.alunosIds.push(alunoId);
    persistTurmas();
    return { ok: true, message: `${aluno.nome} vinculado à turma.` };
  }

  function desmatricularAluno(turmaId, alunoId) {
    const turma = turmas.find((t) => t.id === turmaId);
    if (!turma) return;
    turma.alunosIds = turma.alunosIds.filter((id) => id !== alunoId);
    persistTurmas();
  }

  function addNota({ turmaId, alunoId, valor, observacao, professorId, tipo, provaId }) {
    const nota = {
      id: `n-${Date.now()}`,
      turmaId,
      alunoId,
      valor: Number(valor),
      tipo: tipo || "P1",
      provaId: provaId || "",
      observacao: observacao || "",
      professorId,
      createdAt: new Date().toISOString()
    };
    notas.push(nota);
    persistNotas();
    return nota;
  }

  function addAtividade({ turmaId, titulo, descricao, prazo, professorId, tipo }) {
    const item = {
      id: `a-${Date.now()}`,
      turmaId,
      titulo,
      descricao: descricao || "",
      prazo: prazo || "",
      tipo: tipo || "atividade",
      professorId,
      createdAt: new Date().toISOString()
    };
    atividades.unshift(item);
    persistAtividades();
    return item;
  }

  function removeAtividade(id) {
    atividades = atividades.filter((a) => a.id !== id);
    entregas = entregas.filter((e) => e.atividadeId !== id);
    persistAtividades();
    persistEntregas();
  }

  function addProva({ turmaId, titulo, descricao, data, peso, status, professorId }) {
    const item = {
      id: `p-${Date.now()}`,
      turmaId,
      titulo,
      descricao: descricao || "",
      data: data || todayISO(),
      peso: Number(peso) || 1,
      status: status || "agendada",
      professorId,
      createdAt: new Date().toISOString()
    };
    provas.unshift(item);
    persistProvas();
    return item;
  }

  function removeProva(id) {
    provas = provas.filter((p) => p.id !== id);
    persistProvas();
  }

  function entregarAtividade({ atividadeId, alunoId, texto }) {
    const existing = entregas.find(
      (e) => e.atividadeId === atividadeId && e.alunoId === alunoId
    );
    if (existing) {
      existing.texto = texto;
      existing.createdAt = new Date().toISOString();
      persistEntregas();
      return existing;
    }
    const item = {
      id: `e-${Date.now()}`,
      atividadeId,
      alunoId,
      texto: texto || "",
      createdAt: new Date().toISOString()
    };
    entregas.unshift(item);
    persistEntregas();
    return item;
  }

  function getEntrega(atividadeId, alunoId) {
    return (
      entregas.find((e) => e.atividadeId === atividadeId && e.alunoId === alunoId) ||
      null
    );
  }

  function mediaPonderadaTurma(turmaId, alunoId) {
    const lista = notas.filter((n) => n.turmaId === turmaId && n.alunoId === alunoId);
    if (!lista.length) return null;
    const pesos = { P1: 3, P2: 4, Trabalho: 2, Atividade: 1, "Prova Extra": 2 };
    let soma = 0;
    let pesoTotal = 0;
    lista.forEach((n) => {
      const p = pesos[n.tipo] || 1;
      soma += Number(n.valor) * p;
      pesoTotal += p;
    });
    return pesoTotal ? soma / pesoTotal : null;
  }

  function situacaoMedia(media) {
    if (media === null || media === undefined) return { label: "Sem notas", tone: "soft" };
    if (media >= 7) return { label: "Aprovado", tone: "success" };
    if (media >= 5) return { label: "Exame", tone: "warning" };
    return { label: "Reprovado", tone: "error" };
  }

  function addFalta({ turmaId, alunoId, data, motivo, professorId }) {
    const item = {
      id: `f-${Date.now()}`,
      turmaId,
      alunoId,
      data: data || todayISO(),
      motivo: motivo || "",
      professorId,
      createdAt: new Date().toISOString()
    };
    faltas.unshift(item);
    persistFaltas();
    return item;
  }

  function removeFalta(id) {
    faltas = faltas.filter((f) => f.id !== id);
    persistFaltas();
  }

  /* ---------- UI helpers ---------- */

  function fillTurmaSelect(selectEl, professorId, withEmptyLabel) {
    if (!selectEl) return;
    const lista = getTurmasDoProfessor(professorId);
    if (!lista.length) {
      selectEl.innerHTML = `<option value="">Nenhuma turma vinculada</option>`;
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    const options = lista
      .map(
        (t) =>
          `<option value="${t.id}">${t.nome} — Turma ${t.codigo} (${t.alunosIds.length} alunos)</option>`
      )
      .join("");
    selectEl.innerHTML = withEmptyLabel
      ? `<option value="">Selecione a turma</option>${options}`
      : options;
  }

  function fillAlunosDaTurmaSelect(selectEl, turmaId) {
    if (!selectEl) return;
    const turma = turmas.find((t) => t.id === turmaId);
    if (!turma || !turma.alunosIds.length) {
      selectEl.innerHTML = `<option value="">Nenhum aluno vinculado</option>`;
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    selectEl.innerHTML = turma.alunosIds
      .map((id) => {
        const aluno = findUser(id);
        if (!aluno) return "";
        return `<option value="${aluno.id}">${aluno.nome} · RA ${aluno.ra}</option>`;
      })
      .filter(Boolean)
      .join("");
  }

  function fillAlunosDisponiveisSelect(selectEl, turmaId) {
    if (!selectEl) return;
    const turma = turmas.find((t) => t.id === turmaId);
    const matriculados = new Set(turma?.alunosIds || []);
    const disponiveis = getUsers().filter(
      (u) => u.role === "aluno" && !matriculados.has(u.id)
    );
    if (!disponiveis.length) {
      selectEl.innerHTML = `<option value="">Nenhum aluno disponível</option>`;
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    selectEl.innerHTML = disponiveis
      .map((a) => `<option value="${a.id}">${a.nome} · RA ${a.ra}</option>`)
      .join("");
  }

  function renderAdminTurmasTable() {
    const tbody = document.getElementById("adminTurmasTableBody");
    const empty = document.getElementById("adminTurmasEmpty");
    const tableCard = tbody?.closest(".table-card");
    const chip = document.getElementById("adminTurmasCountChip");
    if (chip) chip.textContent = String(turmas.length);
    if (!tbody) return;

    if (!turmas.length) {
      tbody.innerHTML = "";
      if (tableCard) tableCard.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    if (tableCard) tableCard.hidden = false;
    if (empty) empty.hidden = true;

    tbody.innerHTML = turmas
      .map((turma) => {
        const prof = resolveProfessor(turma.professorId) || resolveProfessor(turma.professorRa);
        const profLabel = prof
          ? `${prof.nome} · RA ${prof.ra}`
          : turma.professorNome
            ? `${turma.professorNome}${turma.professorRa ? ` · RA ${turma.professorRa}` : ""}`
            : "—";
        return `
        <tr>
          <td>${turma.nome}</td>
          <td><code>${turma.codigo}</code></td>
          <td>${profLabel}</td>
          <td>${turma.horario || "—"}</td>
          <td>${turma.alunosIds.length}</td>
          <td>
            <button class="btn btn--text" type="button" data-remove-turma="${turma.id}">Remover</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-remove-turma]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.removeTurma;
        const target = turmas.find((t) => t.id === id);
        removeTurma(id);
        refreshAll();
        if (typeof showSnackbar === "function") {
          showSnackbar(target ? `Turma “${target.nome}” removida.` : "Turma removida.");
        }
      });
    });
  }

  function renderProfessorHome(professorId) {
    const turmasProf = getTurmasDoProfessor(professorId);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };
    set("profMetricTurmas", turmasProf.length);
    set("profMetricAlunos", countAlunosProfessor(professorId));
    set("profMetricAtividades", atividades.filter((a) =>
      turmasProf.some((t) => t.id === a.turmaId)
    ).length);
    set("profMetricFaltas", faltas.filter((f) =>
      turmasProf.some((t) => t.id === f.turmaId)
    ).length);
  }

  function renderProfessorTurmas(professorId) {
    const list = document.getElementById("turmasList");
    const empty = document.getElementById("profTurmasEmpty");
    if (!list) return;

    const minhas = getTurmasDoProfessor(professorId);
    if (!minhas.length) {
      list.innerHTML = "";
      list.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    list.hidden = false;
    if (empty) empty.hidden = true;

    list.innerHTML = minhas
      .map((turma) => {
        const alunosHtml = turma.alunosIds.length
          ? `<div class="table-wrap roster-wrap">
              <table class="roster-table">
                <colgroup><col class="roster-col-ra" /><col /><col class="roster-col-media" /><col class="roster-col-acao" /></colgroup>
                <thead><tr><th scope="col">RA</th><th scope="col">Nome</th><th scope="col">Média</th><th scope="col">Remover</th></tr></thead>
                <tbody>${turma.alunosIds
                  .map((id) => {
                    const aluno = findUser(id);
                    if (!aluno) return "";
                    const media = mediaTurmaAluno(turma.id, id);
                    return `<tr>
                      <td><code>${aluno.ra || "—"}</code></td>
                      <td class="roster-nome" title="${aluno.nome}">${aluno.nome}</td>
                      <td>${mediaChip(media)}</td>
                      <td><button class="btn btn--text roster-remove" type="button" data-unlink-aluno="${turma.id}:${id}"
                        aria-label="Remover ${aluno.nome} da turma">
                        <span class="material-symbols-outlined" aria-hidden="true">person_remove</span>Remover</button></td>
                    </tr>`;
                  })
                  .join("")}</tbody>
              </table>
            </div>`
          : `<p class="muted">Nenhum aluno vinculado ainda.</p>`;

        return `
        <article class="card disc-card disc-card--stack">
          <div class="disc-card__top">
            <div class="disc-card__icon" aria-hidden="true">
              <span class="material-symbols-outlined">menu_book</span>
            </div>
            <div class="disc-card__grow">
              <h3>${turma.nome}</h3>
              <p>Turma ${turma.codigo}${turma.horario ? ` · ${turma.horario}` : ""} · ${turma.alunosIds.length} aluno(s)</p>
              <div class="disc-card__meta">
                <span class="chip chip--${turma.alunosIds.length ? "success" : "warning"}">
                  ${turma.alunosIds.length ? "Com alunos" : "Sem alunos"}
                </span>
              </div>
            </div>
            <button class="btn btn--filled" type="button" data-enroll-turma="${turma.id}">
              <span class="material-symbols-outlined" aria-hidden="true">person_add</span>
              Vincular aluno
            </button>
          </div>
          <div class="disc-card__body">
            <p class="eyebrow">Alunos vinculados</p>
            ${alunosHtml}
          </div>
        </article>`;
      })
      .join("");

    list.querySelectorAll("[data-enroll-turma]").forEach((btn) => {
      btn.addEventListener("click", () => openEnrollDialog(btn.dataset.enrollTurma));
    });

    list.querySelectorAll("[data-unlink-aluno]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [turmaId, alunoId] = btn.dataset.unlinkAluno.split(":");
        const aluno = findUser(alunoId);
        desmatricularAluno(turmaId, alunoId);
        refreshAll();
        if (typeof showSnackbar === "function") {
          showSnackbar(aluno ? `${aluno.nome} removido da turma.` : "Aluno removido.");
        }
      });
    });
  }

  function openEnrollDialog(turmaId) {
    const dialog = document.getElementById("enrollDialog");
    const turma = turmas.find((t) => t.id === turmaId);
    if (!dialog || !turma) return;
    document.getElementById("enrollTurmaId").value = turmaId;
    document.getElementById("enrollTurmaLabel").textContent =
      `${turma.nome} — Turma ${turma.codigo}`;
    fillAlunosDisponiveisSelect(document.getElementById("enrollAlunoSelect"), turmaId);
    dialog.hidden = false;
    document.getElementById("enrollAlunoSelect").focus();
  }

  function closeEnrollDialog() {
    const dialog = document.getElementById("enrollDialog");
    if (dialog) dialog.hidden = true;
  }

  function populateNotasForm(professorId) {
    const turmaSelect = document.getElementById("notaTurma");
    const alunoSelect = document.getElementById("notaAluno");
    if (!turmaSelect || !alunoSelect) return;

    fillTurmaSelect(turmaSelect, professorId, false);
    fillAlunosDaTurmaSelect(alunoSelect, turmaSelect.value);

    turmaSelect.onchange = () => {
      fillAlunosDaTurmaSelect(alunoSelect, turmaSelect.value);
    };
  }

  function renderNotasHistorico(professorId) {
    const box = document.getElementById("notasHistorico");
    if (!box) return;
    const turmaIds = new Set(getTurmasDoProfessor(professorId).map((t) => t.id));
    const lista = notas.filter((n) => turmaIds.has(n.turmaId));

    if (!lista.length) {
      box.innerHTML = `<p class="muted">Nenhuma nota lançada ainda.</p>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Turma</th>
              <th>RA</th>
              <th>Aluno</th>
              <th>Tipo</th>
              <th>Nota</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${lista
              .slice()
              .reverse()
              .slice(0, 30)
              .map((n) => {
                const turma = turmas.find((t) => t.id === n.turmaId);
                return `<tr>
                  <td>${turma ? `${turma.nome} (${turma.codigo})` : "—"}</td>
                  <td><code>${alunoRa(n.alunoId)}</code></td>
                  <td>${alunoNome(n.alunoId)}</td>
                  <td><span class="chip chip--soft">${n.tipo || "P1"}</span></td>
                  <td><strong>${formatNota(n.valor)}</strong></td>
                  <td>${new Date(n.createdAt).toLocaleString("pt-BR")}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  function populateAtividadeForm(professorId) {
    fillTurmaSelect(document.getElementById("atividadeTurma"), professorId, false);
  }

  function renderAtividadesProfessor(professorId) {
    const box = document.getElementById("atividadesListProf");
    if (!box) return;
    const turmaIds = new Set(getTurmasDoProfessor(professorId).map((t) => t.id));
    const lista = atividades.filter((a) => turmaIds.has(a.turmaId));

    if (!lista.length) {
      box.innerHTML = `<div class="empty-state empty-state--compact"><h3>Nenhuma atividade</h3><p>Lance a primeira atividade para uma turma.</p></div>`;
      return;
    }

    box.innerHTML = lista
      .map((a) => {
        const turma = turmas.find((t) => t.id === a.turmaId);
        const qtdEntregas = entregas.filter((e) => e.atividadeId === a.id).length;
        const totalAlunos = turma?.alunosIds?.length || 0;
        return `
        <article class="card panel">
          <div class="panel__head">
            <div>
              <p class="eyebrow">${turma ? `${turma.nome} · Turma ${turma.codigo}` : "Turma"}</p>
              <h3>${a.titulo}</h3>
            </div>
            <div class="panel__actions">
              <span class="chip chip--success">${qtdEntregas}/${totalAlunos} entregas</span>
              <button class="btn btn--text" type="button" data-remove-atividade="${a.id}">Excluir</button>
            </div>
          </div>
          <p>${a.descricao || "Sem descrição."}</p>
          <p class="muted">Prazo: ${a.prazo ? new Date(a.prazo + "T12:00:00").toLocaleDateString("pt-BR") : "não definido"}</p>
          ${
            qtdEntregas
              ? `<div class="table-wrap roster-wrap">
                  <table class="roster-table">
                    <colgroup><col class="roster-col-ra" /><col /><col class="roster-col-data" /></colgroup>
                    <thead><tr><th scope="col">RA</th><th scope="col">Aluno</th><th scope="col">Entregue em</th></tr></thead>
                    <tbody>${entregas
                      .filter((e) => e.atividadeId === a.id)
                      .map(
                        (e) =>
                          `<tr><td><code>${alunoRa(e.alunoId)}</code></td><td class="roster-nome">${alunoNome(e.alunoId)}</td><td class="muted">${new Date(e.createdAt).toLocaleString("pt-BR")}</td></tr>`
                      )
                      .join("")}</tbody>
                  </table>
                </div>`
              : `<p class="muted">Nenhuma entrega ainda.</p>`
          }
        </article>`;
      })
      .join("");

    box.querySelectorAll("[data-remove-atividade]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeAtividade(btn.dataset.removeAtividade);
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar("Atividade removida.");
      });
    });
  }

  function populateProvaForm(professorId) {
    fillTurmaSelect(document.getElementById("provaTurma"), professorId, false);
  }

  function renderProvasProfessor(professorId) {
    const box = document.getElementById("provasListProf");
    if (!box) return;
    const turmaIds = new Set(getTurmasDoProfessor(professorId).map((t) => t.id));
    const lista = provas.filter((p) => turmaIds.has(p.turmaId));

    if (!lista.length) {
      box.innerHTML = `<div class="empty-state empty-state--compact"><h3>Nenhuma prova</h3><p>Agende a primeira prova da turma.</p></div>`;
      return;
    }

    box.innerHTML = lista
      .map((p) => {
        const turma = turmas.find((t) => t.id === p.turmaId);
        const tone = p.status === "aplicada" ? "success" : p.status === "cancelada" ? "warning" : "soft";
        return `
        <article class="card panel">
          <div class="panel__head">
            <div>
              <p class="eyebrow">${turma ? `${turma.nome} · ${turma.codigo}` : "Turma"}</p>
              <h3>${p.titulo}</h3>
            </div>
            <div class="panel__actions">
              <span class="chip chip--${tone}">${p.status}</span>
              <span class="chip">Peso ${p.peso}</span>
              <button class="btn btn--text" type="button" data-remove-prova="${p.id}">Excluir</button>
            </div>
          </div>
          <p>${p.descricao || "Sem descrição."}</p>
          <p class="muted">Data: ${p.data ? new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</p>
        </article>`;
      })
      .join("");

    box.querySelectorAll("[data-remove-prova]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeProva(btn.dataset.removeProva);
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar("Prova removida.");
      });
    });
  }

  function populateFrequenciaForm(professorId) {
    const turmaSelect = document.getElementById("faltaTurma");
    const alunoSelect = document.getElementById("faltaAluno");
    if (!turmaSelect || !alunoSelect) return;
    fillTurmaSelect(turmaSelect, professorId, false);
    fillAlunosDaTurmaSelect(alunoSelect, turmaSelect.value);
    turmaSelect.onchange = () => fillAlunosDaTurmaSelect(alunoSelect, turmaSelect.value);
    const dataInput = document.getElementById("faltaData");
    if (dataInput && !dataInput.value) dataInput.value = todayISO();
  }

  function renderFaltasProfessor(professorId) {
    const box = document.getElementById("faltasListProf");
    if (!box) return;
    const turmaIds = new Set(getTurmasDoProfessor(professorId).map((t) => t.id));
    const lista = faltas.filter((f) => turmaIds.has(f.turmaId));

    if (!lista.length) {
      box.innerHTML = `<p class="muted">Nenhuma falta registrada.</p>`;
      return;
    }

    box.innerHTML = `
      <div class="table-wrap">
        <table class="audit-table">
          <thead>
            <tr><th>Data</th><th>Turma</th><th>RA</th><th>Aluno</th><th>Motivo</th><th></th></tr>
          </thead>
          <tbody>
            ${lista
              .map((f) => {
                const turma = turmas.find((t) => t.id === f.turmaId);
                return `<tr>
                  <td>${new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td>${turma ? turma.codigo : "—"}</td>
                  <td><code>${alunoRa(f.alunoId)}</code></td>
                  <td>${alunoNome(f.alunoId)}</td>
                  <td>${f.motivo || "—"}</td>
                  <td><button class="btn btn--text" type="button" data-remove-falta="${f.id}">Excluir</button></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

    box.querySelectorAll("[data-remove-falta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeFalta(btn.dataset.removeFalta);
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar("Falta removida.");
      });
    });
  }

  function renderAlunoDashboard(alunoId) {
    const minhas = getTurmasDoAluno(alunoId);
    const minhasNotas = notas.filter((n) => n.alunoId === alunoId);
    const minhasFaltas = faltas.filter((f) => f.alunoId === alunoId);
    const minhasAtividades = atividades.filter((a) =>
      minhas.some((t) => t.id === a.turmaId)
    );
    const media = mediaAluno(alunoId);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("alunoMetricMedia", formatNota(media));
    setText("alunoMetricMediaHint", media === null ? "Sem notas lançadas ainda" : "Média das notas recebidas");
    setText("metricDisciplinas", String(minhas.length));
    setText("alunoMetricDiscHint", minhas.length ? "Turmas em que você está matriculado" : "Nenhuma matrícula registrada");
    setText("alunoMetricFaltas", String(minhasFaltas.length));
    setText("alunoMetricFaltasHint", minhasFaltas.length ? "Faltas registradas pelos professores" : "Nenhuma falta registrada");
    setText("alunoMetricAtividades", String(minhasAtividades.length));
    setText("alunoMetricAtivHint", minhasAtividades.length ? "Atividades das suas turmas" : "Nenhuma atividade no momento");

    const chip = document.getElementById("disciplinasCountChip");
    if (chip) chip.textContent = String(minhas.length);

    const chartBox = document.getElementById("alunoChartBox");
    if (chartBox) {
      if (!minhasNotas.length) {
        chartBox.innerHTML = `
          <div class="empty-state empty-state--compact" role="status">
            <div class="empty-state__icon" aria-hidden="true">
              <span class="material-symbols-outlined">bar_chart</span>
            </div>
            <h3>Sem notas para exibir</h3>
            <p>O gráfico será preenchido quando o professor lançar notas.</p>
          </div>`;
      } else {
        const recent = minhasNotas.slice(-4);
        chartBox.innerHTML = `
          <div class="chart" role="img" aria-label="Notas recentes">
            <div class="chart__bars">
              ${recent
                .map((n, index) => {
                  const h = Math.max(8, (Number(n.valor) / 10) * 100);
                  return `<div class="chart-bar">
                    <div class="chart-bar__fill ${index === recent.length - 1 ? "chart-bar__fill--accent" : ""}" style="--h:${h}%">
                      <span>${formatNota(n.valor)}</span>
                    </div>
                    <span class="chart-bar__label">N${index + 1}</span>
                  </div>`;
                })
                .join("")}
            </div>
          </div>`;
      }
    }

    const agenda = document.getElementById("alunoAgendaList");
    if (agenda) {
      const upcoming = minhasAtividades
        .filter((a) => a.prazo)
        .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)))
        .slice(0, 5);

      if (!upcoming.length) {
        agenda.innerHTML = `<li class="muted" style="list-style:none;padding:8px 0">Nenhuma atividade com prazo no momento.</li>`;
      } else {
        agenda.innerHTML = upcoming
          .map((a) => {
            const turma = turmas.find((t) => t.id === a.turmaId);
            const d = new Date(a.prazo + "T12:00:00");
            return `<li class="event">
              <div class="event__date" aria-hidden="true">
                <strong>${String(d.getDate()).padStart(2, "0")}</strong>
                <span>${d.toLocaleString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span>
              </div>
              <div>
                <strong>${a.titulo}</strong>
                <p>${turma ? turma.nome : "Turma"} · prazo</p>
              </div>
            </li>`;
          })
          .join("");
      }
    }
  }

  function renderAlunoTurmas(alunoId) {
    const list = document.getElementById("alunoTurmasList");
    const empty = document.getElementById("alunoTurmasEmpty");
    if (!list) return;
    const minhas = getTurmasDoAluno(alunoId);

    if (!minhas.length) {
      list.innerHTML = "";
      list.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    list.hidden = false;
    if (empty) empty.hidden = true;

    list.innerHTML = minhas
      .map((turma) => {
        const prof = findUser(turma.professorId) || resolveProfessor(turma.professorId);
        const media = mediaPonderadaTurma(turma.id, alunoId) ?? mediaTurmaAluno(turma.id, alunoId);
        const sit = situacaoMedia(media);
        const qtdNotas = notas.filter((n) => n.turmaId === turma.id && n.alunoId === alunoId).length;
        const qtdFaltas = faltas.filter((f) => f.turmaId === turma.id && f.alunoId === alunoId).length;
        return `
        <article class="card disc-card">
          <div class="disc-card__icon" aria-hidden="true">
            <span class="material-symbols-outlined">menu_book</span>
          </div>
          <div>
            <h3>${turma.nome}</h3>
            <p>Turma ${turma.codigo} · Prof. ${prof ? prof.nome : "—"}${turma.horario ? ` · ${turma.horario}` : ""}</p>
            <div class="disc-card__meta">
              <span class="chip chip--${sit.tone}">${sit.label} · ${formatNota(media)}</span>
              <span class="chip">${qtdNotas} nota(s)</span>
              <span class="chip chip--warning">${qtdFaltas} falta(s)</span>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderAlunoAtividades(alunoId) {
    const box = document.getElementById("alunoAtividadesList");
    const empty = document.getElementById("alunoAtividadesEmpty");
    if (!box) return;
    const minhas = getTurmasDoAluno(alunoId);
    const lista = atividades.filter((a) => minhas.some((t) => t.id === a.turmaId));

    if (!lista.length) {
      box.innerHTML = "";
      box.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    box.hidden = false;
    if (empty) empty.hidden = true;
    box.innerHTML = lista
      .map((a) => {
        const turma = turmas.find((t) => t.id === a.turmaId);
        const entrega = getEntrega(a.id, alunoId);
        return `
        <article class="card panel">
          <div class="panel__head">
            <div>
              <p class="eyebrow">${turma ? `${turma.nome} · ${turma.codigo}` : "Turma"}</p>
              <h3>${a.titulo}</h3>
            </div>
            <span class="chip ${entrega ? "chip--success" : ""}">${
              entrega ? "Entregue" : a.prazo ? new Date(a.prazo + "T12:00:00").toLocaleDateString("pt-BR") : "Sem prazo"
            }</span>
          </div>
          <p>${a.descricao || "Sem descrição."}</p>
          ${
            entrega
              ? `<p class="muted">Sua entrega: ${entrega.texto}</p>`
              : `<div class="inline-deliver">
                  <label class="field">
                    <span class="field__label">Enviar resposta / link</span>
                    <input class="field__input" data-entrega-input="${a.id}" type="text" maxlength="240" placeholder="Descreva a entrega ou cole um link" />
                  </label>
                  <button class="btn btn--filled" type="button" data-entregar="${a.id}">Entregar</button>
                </div>`
          }
        </article>`;
      })
      .join("");

    box.querySelectorAll("[data-entregar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.entregar;
        const input = box.querySelector(`[data-entrega-input="${id}"]`);
        const texto = input?.value.trim() || "";
        if (!texto) {
          if (typeof showSnackbar === "function") showSnackbar("Descreva a entrega antes de enviar.");
          return;
        }
        entregarAtividade({ atividadeId: id, alunoId, texto });
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar("Atividade entregue com sucesso!");
      });
    });
  }

  function renderAlunoBoletim(alunoId) {
    const box = document.getElementById("alunoBoletimBox");
    const empty = document.getElementById("alunoBoletimEmpty");
    if (!box) return;
    const minhas = getTurmasDoAluno(alunoId);
    const minhasNotas = notas.filter((n) => n.alunoId === alunoId);

    if (!minhas.length) {
      box.innerHTML = "";
      box.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    box.hidden = false;
    if (empty) empty.hidden = true;

    box.innerHTML = minhas
      .map((turma) => {
        const lista = minhasNotas.filter((n) => n.turmaId === turma.id);
        const media = mediaPonderadaTurma(turma.id, alunoId) ?? mediaTurmaAluno(turma.id, alunoId);
        const sit = situacaoMedia(media);
        const faltasTurma = faltas.filter((f) => f.turmaId === turma.id && f.alunoId === alunoId).length;
        return `
        <article class="card panel boletim-card">
          <div class="panel__head">
            <div>
              <p class="eyebrow">${turma.codigo}${turma.horario ? ` · ${turma.horario}` : ""}</p>
              <h3>${turma.nome}</h3>
            </div>
            <span class="chip chip--${sit.tone}">${sit.label} · média ${formatNota(media)}</span>
          </div>
          <div class="table-wrap">
            <table class="audit-table">
              <thead>
                <tr><th>Tipo</th><th>Nota</th><th>Observação</th><th>Data</th></tr>
              </thead>
              <tbody>
                ${
                  lista.length
                    ? lista
                        .map(
                          (n) => `<tr>
                            <td><span class="chip chip--soft">${n.tipo || "P1"}</span></td>
                            <td><strong>${formatNota(n.valor)}</strong></td>
                            <td>${n.observacao || "—"}</td>
                            <td>${new Date(n.createdAt).toLocaleDateString("pt-BR")}</td>
                          </tr>`
                        )
                        .join("")
                    : `<tr><td colspan="4">Nenhuma nota lançada nesta disciplina.</td></tr>`
                }
              </tbody>
            </table>
          </div>
          <p class="muted">Faltas: ${faltasTurma}</p>
        </article>`;
      })
      .join("");
  }

  function renderAlunoProvas(alunoId) {
    const box = document.getElementById("alunoProvasList");
    const empty = document.getElementById("alunoProvasEmpty");
    if (!box) return;
    const minhas = getTurmasDoAluno(alunoId);
    const lista = provas.filter((p) => minhas.some((t) => t.id === p.turmaId));

    if (!lista.length) {
      box.innerHTML = "";
      box.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    box.hidden = false;
    if (empty) empty.hidden = true;
    box.innerHTML = lista
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map((p) => {
        const turma = turmas.find((t) => t.id === p.turmaId);
        const tone = p.status === "aplicada" ? "success" : "soft";
        return `
        <article class="card disc-card">
          <div class="disc-card__icon" aria-hidden="true">
            <span class="material-symbols-outlined">quiz</span>
          </div>
          <div>
            <h3>${p.titulo}</h3>
            <p>${turma ? turma.nome : "Turma"} · ${p.descricao || "Sem descrição"}</p>
            <div class="disc-card__meta">
              <span class="chip chip--${tone}">${p.status}</span>
              <span class="chip">Peso ${p.peso}</span>
              <span class="chip">${p.data ? new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</span>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  function refreshAll() {
    // Repara vínculos com a lista atual de usuários (id/RA) e redesenha a UI.
    turmas = turmas.map(repairTurmaProfessor);
    persistTurmasQuiet();

    const user = typeof currentUser !== "undefined" ? currentUser : null;
    renderAdminTurmasTable();

    if (!user) return;

    if (user.role === "professor") {
      renderProfessorHome(user.id);
      renderProfessorTurmas(user.id);
      populateNotasForm(user.id);
      renderNotasHistorico(user.id);
      populateAtividadeForm(user.id);
      renderAtividadesProfessor(user.id);
      populateProvaForm(user.id);
      renderProvasProfessor(user.id);
      populateFrequenciaForm(user.id);
      renderFaltasProfessor(user.id);
    }

    if (user.role === "aluno") {
      renderAlunoDashboard(user.id);
      renderAlunoTurmas(user.id);
      renderAlunoAtividades(user.id);
      renderAlunoBoletim(user.id);
      renderAlunoProvas(user.id);
    }

    if (user.role === "admin") {
      renderAdminTurmasTable();
    }
  }

  function refreshAllFromStorage() {
    reloadFromStorage();
    if (typeof window.reloadEduUsers === "function") window.reloadEduUsers();
    refreshAll();
  }

  function bindUi() {
    const enrollForm = document.getElementById("enrollForm");
    if (enrollForm) {
      enrollForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const turmaId = document.getElementById("enrollTurmaId").value;
        const alunoId = document.getElementById("enrollAlunoSelect").value;
        const result = matricularAluno(turmaId, alunoId);
        if (!result.ok) {
          if (typeof showSnackbar === "function") showSnackbar(result.message);
          return;
        }
        closeEnrollDialog();
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar(result.message);
      });
    }

    document.querySelectorAll("[data-enroll-dialog-close]").forEach((el) => {
      el.addEventListener("click", closeEnrollDialog);
    });

    const notasForm = document.getElementById("notasForm");
    const notaValorInput = document.getElementById("notaValor");
    const notaError = document.getElementById("notaError");
    const notaErrorText = document.getElementById("notaErrorText");

    function clampNota() {
      if (!notaValorInput || notaValorInput.value === "") return;
      let value = Number(notaValorInput.value);
      if (Number.isNaN(value)) {
        notaValorInput.value = "0";
        return;
      }
      if (value > 10) notaValorInput.value = "10";
      if (value < 0) notaValorInput.value = "0";
    }

    if (notaValorInput) {
      notaValorInput.addEventListener("input", clampNota);
      notaValorInput.addEventListener("change", clampNota);
      notaValorInput.addEventListener("blur", clampNota);
    }

    if (notasForm) {
      notasForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (notaError) notaError.hidden = true;
        if (!currentUser || currentUser.role !== "professor") return;

        const turmaId = document.getElementById("notaTurma").value;
        const alunoId = document.getElementById("notaAluno").value;
        let valor = Number(notaValorInput.value);
        const observacao = document.getElementById("notaObs")?.value.trim() || "";
        const tipo = document.getElementById("notaTipo")?.value || "P1";

        const turma = turmas.find((t) => t.id === turmaId);
        if (!turma || !turmaBelongsToProfessor(turma, currentUser.id)) {
          if (typeof showSnackbar === "function") showSnackbar("Turma inválida.");
          return;
        }
        if (!turma.alunosIds.includes(alunoId)) {
          if (typeof showSnackbar === "function") {
            showSnackbar("Vincule o aluno à turma antes de lançar nota.");
          }
          return;
        }
        if (Number.isNaN(valor) || valor < 0 || valor > 10) {
          if (notaErrorText) {
            notaErrorText.textContent =
              "A nota deve estar entre 0 e 10. Valores acima de 10 não são permitidos.";
          }
          if (notaError) {
            notaError.hidden = false;
            notaError.focus();
          }
          clampNota();
          return;
        }

        valor = Math.min(10, Math.max(0, valor));
        const btn = document.getElementById("salvarNota");
        const spinner = document.getElementById("notaSpinner");
        const label = document.getElementById("notaLabel");
        btn.disabled = true;
        if (spinner) spinner.hidden = false;
        if (label) label.textContent = "Salvando...";

        window.setTimeout(() => {
          addNota({
            turmaId,
            alunoId,
            valor,
            observacao,
            tipo,
            professorId: currentUser.id
          });
          btn.disabled = false;
          if (spinner) spinner.hidden = true;
          if (label) label.textContent = "Salvar nota";
          refreshAll();
          if (typeof showSnackbar === "function") {
            showSnackbar(`${tipo} · nota ${formatNota(valor)} lançada para ${userLabel(alunoId)}.`);
          }
        }, 900);
      });
    }

    const atividadeForm = document.getElementById("atividadeForm");
    if (atividadeForm) {
      atividadeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!currentUser || currentUser.role !== "professor") return;
        const turmaId = document.getElementById("atividadeTurma").value;
        const titulo = document.getElementById("atividadeTitulo").value.trim();
        const descricao = document.getElementById("atividadeDesc").value.trim();
        const prazo = document.getElementById("atividadePrazo").value;
        if (!turmaId || !titulo) {
          if (typeof showSnackbar === "function") showSnackbar("Informe turma e título.");
          return;
        }
        addAtividade({
          turmaId,
          titulo,
          descricao,
          prazo,
          professorId: currentUser.id
        });
        atividadeForm.reset();
        populateAtividadeForm(currentUser.id);
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar("Atividade lançada.");
      });
    }

    const provaForm = document.getElementById("provaForm");
    if (provaForm) {
      provaForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!currentUser || currentUser.role !== "professor") return;
        const turmaId = document.getElementById("provaTurma").value;
        const titulo = document.getElementById("provaTitulo").value.trim();
        const descricao = document.getElementById("provaDesc").value.trim();
        const data = document.getElementById("provaData").value;
        const peso = document.getElementById("provaPeso").value;
        const status = document.getElementById("provaStatus").value;
        if (!turmaId || !titulo || !data) {
          if (typeof showSnackbar === "function") showSnackbar("Informe turma, título e data.");
          return;
        }
        addProva({
          turmaId,
          titulo,
          descricao,
          data,
          peso,
          status,
          professorId: currentUser.id
        });
        provaForm.reset();
        populateProvaForm(currentUser.id);
        refreshAll();
        if (typeof showSnackbar === "function") showSnackbar("Prova agendada com sucesso.");
      });
    }

    const faltaForm = document.getElementById("faltaForm");
    if (faltaForm) {
      faltaForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!currentUser || currentUser.role !== "professor") return;
        const turmaId = document.getElementById("faltaTurma").value;
        const alunoId = document.getElementById("faltaAluno").value;
        const data = document.getElementById("faltaData").value;
        const motivo = document.getElementById("faltaMotivo").value.trim();
        const turma = turmas.find((t) => t.id === turmaId);
        if (!turma || !turma.alunosIds.includes(alunoId)) {
          if (typeof showSnackbar === "function") {
            showSnackbar("Selecione turma e aluno vinculados.");
          }
          return;
        }
        addFalta({
          turmaId,
          alunoId,
          data,
          motivo,
          professorId: currentUser.id
        });
        document.getElementById("faltaMotivo").value = "";
        refreshAll();
        if (typeof showSnackbar === "function") {
          showSnackbar(`Falta registrada para ${userLabel(alunoId)}.`);
        }
      });
    }
  }

  init();
  bindLiveSync();

  return {
    init,
    reloadFromStorage,
    refreshAll,
    refreshAllFromStorage,
    bindUi,
    createTurma,
    getTurmasDoProfessor,
    resolveProfessor,
    getProfessorOptionsHtml: (selectedId) =>
      getUsers()
        .filter((u) => u.role === "professor")
        .map(
          (u) =>
            `<option value="${u.id}" ${u.id === selectedId ? "selected" : ""}>${u.nome} · RA ${u.ra}</option>`
        )
        .join(""),
    closeEnrollDialog,
    resetDemoSeed: () => {
      localStorage.removeItem(DEMO_SEED_KEY);
      localStorage.removeItem(TURMAS_KEY);
      localStorage.removeItem(NOTAS_KEY);
      localStorage.removeItem(ATIVIDADES_KEY);
      localStorage.removeItem(FALTAS_KEY);
      localStorage.removeItem(PROVAS_KEY);
      localStorage.removeItem(ENTREGAS_KEY);
      turmas = [];
      notas = [];
      atividades = [];
      faltas = [];
      provas = [];
      entregas = [];
      ensureDemoSeed();
      refreshAll();
    },
    get turmas() {
      return turmas;
    },
    get provas() {
      return provas;
    },
    get notas() {
      return notas;
    }
  };
})();

// `const ACADEMIC` não cria window.ACADEMIC — necessário para o login redesenhar as turmas.
window.ACADEMIC = ACADEMIC;
