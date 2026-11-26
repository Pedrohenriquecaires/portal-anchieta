/* ============================================================
   Portal Anchieta — Auth por cargos + portal Material
   Admin · Professor · Aluno
   ============================================================ */

"use strict";

/* ---------- Constantes / storage ---------- */

const USERS_KEY = "educonnect-users-v2";
/* Contas demo excluídas pela coordenação (não são recriadas). */
const REMOVED_SEEDS_KEY = "educonnect-removed-seeds";
const SESSION_KEY = "educonnect-session-v2";

const ROLE_LABELS = {
  admin: "Coordenador",
  professor: "Professor",
  aluno: "Aluno"
};

const ROLE_AREAS = {
  admin: "Área da coordenação",
  professor: "Área do professor",
  aluno: "Área do aluno"
};

const DEFAULT_HOME = {
  admin: "admin-home",
  professor: "prof-home",
  aluno: "dashboard"
};

const VIEW_TITLES = {
  dashboard: "Dashboard",
  "aluno-turmas": "Minhas turmas",
  "aluno-boletim": "Boletim / Notas",
  "aluno-provas": "Provas",
  "aluno-atividades": "Atividades",
  perfil: "Meu perfil",
  auditoria: "8 melhorias",
  apresentacao: "Antes × Depois",
  "admin-home": "Painel Coordenação",
  usuarios: "Usuários",
  "admin-turmas": "Turmas",
  "prof-home": "Painel Professor",
  turmas: "Minhas turmas",
  notas: "Lançar notas",
  provas: "Provas",
  atividades: "Atividades",
  frequencia: "Frequência",
  banco: "Banco de dados"
};

const SEED_USERS = [
  {
    id: "u-admin",
    nome: "Vanderlei Ienne",
    login: "admin",
    ra: "",
    cpf: "",
    senha: "Admin@123",
    email: "vanderlei.ienne@anchieta.edu.br",
    telefone: "(11) 90000-0000",
    role: "admin",
    meta: "Coordenação do curso",
    locked: true
  },
  {
    id: "u-prof",
    nome: "Daniel Feitoza",
    login: "",
    ra: "230526",
    cpf: "23052600000",
    senha: "23052600000",
    email: "daniel.feitoza@anchieta.edu.br",
    telefone: "",
    role: "professor",
    meta: "Docente · Design",
    locked: false
  },
  {
    id: "u-aluno",
    nome: "Gustavo Henrique Mira",
    login: "",
    ra: "2609681",
    cpf: "46580142898",
    senha: "46580142898",
    email: "gustavo.mira@anchieta.edu.br",
    telefone: "",
    role: "aluno",
    meta: "RA 2609681",
    locked: false
  },
  {
    id: "u-aluno-2",
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
  },
  {
    id: "u-aluno-3",
    nome: "Abimael Jabez",
    login: "",
    ra: "2524073",
    cpf: "25240730000",
    senha: "25240730000",
    email: "abimael.jabez@anchieta.edu.br",
    telefone: "",
    role: "aluno",
    meta: "RA 2524073",
    locked: false
  },
  {
    id: "u-aluno-4",
    nome: "Juliano Albuquerque",
    login: "",
    ra: "2521476",
    cpf: "25214760000",
    senha: "25214760000",
    email: "juliano.albuquerque@anchieta.edu.br",
    telefone: "",
    role: "aluno",
    meta: "RA 2521476",
    locked: false
  },
  {
    id: "u-aluno-5",
    nome: "Adrian Mello",
    login: "",
    ra: "2520269",
    cpf: "25202690000",
    senha: "25202690000",
    email: "adrian.mello@anchieta.edu.br",
    telefone: "",
    role: "aluno",
    meta: "RA 2520269",
    locked: false
  },
  {
    id: "u-aluno-6",
    nome: "Lucas Boscardin",
    login: "",
    ra: "2506119",
    cpf: "25061190000",
    senha: "25061190000",
    email: "lucas.boscardin@anchieta.edu.br",
    telefone: "",
    role: "aluno",
    meta: "RA 2506119",
    locked: false
  },
  {
    id: "u-aluno-7",
    nome: "Eduardo Scarpinelli",
    login: "",
    ra: "2509329",
    cpf: "25093290000",
    senha: "25093290000",
    email: "eduardo.scarpinelli@anchieta.edu.br",
    telefone: "",
    role: "aluno",
    meta: "RA 2509329",
    locked: false
  }
];

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function maskCpf(cpf) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return digits || "—";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

/* Quando a lista de pessoas padrão muda, limpa os usuários antigos salvos no
   navegador para que as contas novas apareçam (troque o texto para forçar de novo). */
const SEED_VERSION = "2026.11.26-turma";
/* Com banco de dados (db.js online) os dados vêm do servidor: nada de limpar o cache. */
const DB_ONLINE = Boolean(window.EDU_DB && window.EDU_DB.online);

if (!DB_ONLINE && localStorage.getItem("educonnect-seed-version") !== SEED_VERSION) {
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(REMOVED_SEEDS_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.setItem("educonnect-seed-version", SEED_VERSION);
}

let users = loadUsers();
let currentUser = null;
let snackbarTimer = null;
let academicBound = false;

/* Contas demo excluídas pela coordenação não devem ser recriadas. */

function getRemovedSeeds() {
  try {
    const list = JSON.parse(localStorage.getItem(REMOVED_SEEDS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function markSeedRemoved(id) {
  if (!SEED_USERS.some((seed) => seed.id === id)) return;
  const list = getRemovedSeeds();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(REMOVED_SEEDS_KEY, JSON.stringify(list));
  }
}

/** Remove o usuário das turmas (como aluno) para não sobrar vínculo órfão. */
function unlinkUserFromTurmas(id) {
  try {
    const key = "educonnect-turmas-v2";
    const turmas = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(turmas)) return;
    let changed = false;
    turmas.forEach((turma) => {
      if (Array.isArray(turma.alunosIds) && turma.alunosIds.includes(id)) {
        turma.alunosIds = turma.alunosIds.filter((alunoId) => alunoId !== id);
        changed = true;
      }
    });
    if (changed) localStorage.setItem(key, JSON.stringify(turmas));
  } catch {
    /* ignore */
  }
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
      return structuredClone(SEED_USERS);
    }
    const parsed = JSON.parse(raw);
    // Online: a lista oficial é a do banco (não recria contas demo no navegador)
    if (window.EDU_DB && window.EDU_DB.online && Array.isArray(parsed)) return parsed;
    if (!Array.isArray(parsed) || !parsed.length) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
      return structuredClone(SEED_USERS);
    }
    // Garante usuários demo oficiais (Marina etc.) sem apagar cadastros novos
    let changed = false;
    const removedSeeds = getRemovedSeeds();
    SEED_USERS.forEach((seed) => {
      if (removedSeeds.includes(seed.id)) return;
      if (!parsed.some((u) => u.id === seed.id || (seed.ra && onlyDigits(u.ra) === onlyDigits(seed.ra)))) {
        parsed.push(structuredClone(seed));
        changed = true;
      }
    });
    if (changed) localStorage.setItem(USERS_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return structuredClone(SEED_USERS);
  }
}

function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  try {
    if (!window.__eduUsersChannel) {
      window.__eduUsersChannel = new BroadcastChannel("educonnect-users");
    }
    window.__eduUsersChannel.postMessage({ type: "users-updated", at: Date.now() });
  } catch {
    /* ignore */
  }
}

/** Mantém a lista de usuários alinhada ao localStorage (outras abas / refresh). */
function reloadEduUsers() {
  const previousId = currentUser?.id || null;
  users = loadUsers();
  if (!previousId) return;
  const fresh = users.find((item) => item.id === previousId);
  if (fresh) currentUser = fresh;
  else if (currentUser) logout();
}

window.reloadEduUsers = reloadEduUsers;

function getSessionId() {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(userId) {
  localStorage.setItem(SESSION_KEY, userId);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ---------- DOM ---------- */

const body = document.body;
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const loginError = document.getElementById("loginError");
const loginErrorText = document.getElementById("loginErrorText");
const loginSubmit = document.getElementById("loginSubmit");
const loginSpinner = document.getElementById("loginSpinner");
const loginLabel = document.getElementById("loginLabel");

const openDrawerBtn = document.getElementById("openDrawer");
const closeDrawerBtn = document.getElementById("closeDrawer");
const drawerScrim = document.getElementById("drawerScrim");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const semesterSelect = document.getElementById("semesterSelect");
const pageTitle = document.getElementById("pageTitle");
const mainContent = document.getElementById("conteudo-principal");
const areaLabel = document.getElementById("areaLabel");

const snackbar = document.getElementById("snackbar");
const snackbarMessage = document.getElementById("snackbarMessage");
const snackbarIcon = document.getElementById("snackbarIcon");
const snackbarClose = document.getElementById("snackbarClose");
const notificationButton = document.getElementById("notificationButton");
const notificationDot = document.getElementById("notificationDot");
const notifPanel = document.getElementById("notifPanel");
const notifList = document.getElementById("notifList");
const notifCountChip = document.getElementById("notifCountChip");

const userDialog = document.getElementById("userDialog");
const userForm = document.getElementById("userForm");

const perfilForm = document.getElementById("perfilForm");
const nomeInput = document.getElementById("nomeInput");
const emailInput = document.getElementById("emailInput");
const telefoneInput = document.getElementById("telefoneInput");
const simularErro = document.getElementById("simularErro");
const perfilError = document.getElementById("perfilError");
const salvarPerfilBtn = document.getElementById("salvarPerfil");
const salvarSpinner = document.getElementById("salvarSpinner");
const salvarLabel = document.getElementById("salvarLabel");
const nomeError = document.getElementById("nomeError");
const emailError = document.getElementById("emailError");

/* ---------- Helpers ---------- */

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleAllowed(el, role) {
  const raw = el.getAttribute("data-roles");
  if (!raw) return true;
  return raw
    .split(",")
    .map((item) => item.trim())
    .includes(role);
}

function canAccessView(viewId, role) {
  const view = document.getElementById(`view-${viewId}`);
  if (!view) return false;
  return roleAllowed(view, role);
}

function firstName(fullName) {
  return String(fullName || "").trim().split(/\s+/).filter(Boolean)[0] || "usuário";
}

/** Heurística simples PT-BR para tratamento Professor/Professora, Aluno/Aluna. */
function isFeminineName(fullName) {
  const first = firstName(fullName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const masculine = new Set([
    "joshua", "luca", "noah", "nikita", "guia", "caua", "lucca", "nikolas"
  ]);
  if (masculine.has(first)) return false;

  const feminine = new Set([
    "alice", "beatriz", "ines", "iris", "lais", "mercedes", "raquel", "rachel",
    "rosalind", "sophie", "sofie", "mavis", "agnes", "ines", "luz"
  ]);
  if (feminine.has(first)) return true;

  return /a$/.test(first);
}

function roleGreetingTitle(user) {
  const feminine = isFeminineName(user.nome);
  if (user.role === "professor") return feminine ? "Professora" : "Professor";
  if (user.role === "aluno") return feminine ? "Aluna" : "Aluno";
  return feminine ? "Coordenadora" : "Coordenador";
}

function displayFirstName(user) {
  const name = firstName(user.nome);
  // Evita "Coordenador Coordenação" no usuário seed.
  if (user.role === "admin" && /^(administrad|coorden)/i.test(name)) return "";
  return name;
}

function welcomeMessage(user) {
  const feminine = isFeminineName(user.nome);
  const hello = feminine ? "Bem-vinda" : "Bem-vindo";
  const title = roleGreetingTitle(user);
  const name = displayFirstName(user);
  const who = name ? `${title} ${name}` : title;

  if (user.role === "professor") {
    return `${hello}, ${who}! Suas turmas e lançamentos estão prontos.`;
  }
  if (user.role === "aluno") {
    return `${hello}, ${who}! Confira suas turmas, notas e atividades.`;
  }
  return `${hello}, ${who}! Gerencie usuários e turmas da coordenação.`;
}

function showSnackbar(message, options = {}) {
  const { icon = "check_circle", duration = 3200, variant = "" } = options;
  snackbarMessage.textContent = message;
  if (snackbarIcon) snackbarIcon.textContent = icon;
  snackbar.classList.toggle("snackbar--welcome", variant === "welcome");
  snackbar.classList.add("is-open");
  window.clearTimeout(snackbarTimer);
  snackbarTimer = window.setTimeout(() => {
    snackbar.classList.remove("is-open");
  }, duration);
}

snackbarClose.addEventListener("click", () => {
  snackbar.classList.remove("is-open");
});

/* ---------- Tema ---------- */

function applyTheme(theme) {
  body.dataset.theme = theme;
  localStorage.setItem("educonnect-theme", theme);
  const isDark = theme === "dark";
  themeIcon.textContent = isDark ? "light_mode" : "dark_mode";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Ativar tema claro" : "Ativar tema escuro"
  );
}

const savedTheme = localStorage.getItem("educonnect-theme");
if (savedTheme === "dark" || savedTheme === "light") {
  applyTheme(savedTheme);
} else {
  // Estilo Aurora: o tema escuro é a identidade principal do portal.
  applyTheme("dark");
}

themeToggle.addEventListener("click", () => {
  const next = body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  showSnackbar(next === "dark" ? "Tema escuro ativado." : "Tema claro ativado.");
});

/* ---------- Drawer ---------- */

function openDrawer() {
  body.classList.add("drawer-open");
  openDrawerBtn.setAttribute("aria-expanded", "true");
  closeDrawerBtn.focus();
}

function closeDrawer() {
  body.classList.remove("drawer-open");
  openDrawerBtn.setAttribute("aria-expanded", "false");
}

openDrawerBtn.addEventListener("click", openDrawer);
closeDrawerBtn.addEventListener("click", closeDrawer);
drawerScrim.addEventListener("click", closeDrawer);

window.addEventListener("resize", () => {
  if (window.innerWidth > 820) closeDrawer();
});

/* ---------- Auth / RBAC ---------- */

function applyRoleVisibility(role) {
  document.querySelectorAll("[data-roles]").forEach((el) => {
    const allowed = roleAllowed(el, role);

    if (!allowed) {
      el.hidden = true;
      if (el.classList.contains("view")) el.classList.remove("is-active");
      return;
    }

    // Views permitidas ficam ocultas até setActiveView escolher uma.
    if (el.classList.contains("view")) {
      el.hidden = true;
      el.classList.remove("is-active");
      return;
    }

    el.hidden = false;
  });
}

function syncChrome(user) {
  const initials = initialsFromName(user.nome);
  const roleMeta =
    user.role === "admin"
      ? `${ROLE_LABELS[user.role]} · ${user.meta || user.login}`
      : `${ROLE_LABELS[user.role]} · RA ${user.ra}`;

  document.getElementById("sidebarStudentName").textContent = user.nome;
  document.getElementById("sidebarRoleMeta").textContent = roleMeta;
  document.getElementById("sidebarAvatar").textContent = initials;
  document.getElementById("topbarStudentName").textContent = user.nome;
  document.getElementById("topbarRoleLabel").textContent = ROLE_LABELS[user.role];
  document.getElementById("topbarAvatar").textContent = initials;
  areaLabel.textContent = ROLE_AREAS[user.role];

  nomeInput.value = user.nome;
  emailInput.value = user.email || "";
  telefoneInput.value = user.telefone || "";
  document.getElementById("perfilAvatar").textContent = initials;

  const perfilMeta = document.getElementById("perfilMeta");
  if (perfilMeta) {
    perfilMeta.textContent =
      user.role === "admin"
        ? "Coordenação do curso · Portal acadêmico"
        : `RA ${user.ra} · Curso de Design de Interfaces`;
  }

  const dashHeading = document.getElementById("dash-heading");
  if (dashHeading) {
    dashHeading.textContent = `Olá, ${firstName(user.nome)}`;
  }

  const profHeading = document.getElementById("prof-heading");
  if (profHeading && user.role === "professor") {
    profHeading.textContent = `Olá, ${roleGreetingTitle(user)} ${firstName(user.nome)}`;
  }

  const adminHeading = document.getElementById("admin-heading");
  if (adminHeading && user.role === "admin") {
    const adminName = displayFirstName(user);
    adminHeading.textContent = adminName
      ? `Olá, ${roleGreetingTitle(user)} ${adminName}`
      : `Olá, ${roleGreetingTitle(user)}`;
  }
}

function enterApp(user) {
  currentUser = user;
  setSession(user.id);
  body.classList.add("is-authenticated");
  loginScreen.hidden = true;
  appShell.hidden = false;
  applyRoleVisibility(user.role);
  syncChrome(user);
  renderUsersTable();
  updateAdminMetrics();
  if (window.ACADEMIC) {
    if (!academicBound) {
      ACADEMIC.bindUi();
      academicBound = true;
    }
    // Garante dados do storage + redraw das turmas do professor/aluno.
    ACADEMIC.refreshAllFromStorage();
  }
  setActiveView(DEFAULT_HOME[user.role]);
  closeNotifPanel();
  refreshNotifications();
  // Segundo paint: cobre race de login/navegação.
  window.requestAnimationFrame(() => {
    if (window.ACADEMIC && currentUser) ACADEMIC.refreshAll();
    refreshNotifications();
  });
  showSnackbar(welcomeMessage(user), {
    icon: "waving_hand",
    duration: 4500,
    variant: "welcome"
  });
}

function logout() {
  if (window.EDU_DB) window.EDU_DB.logout();
  clearSession();
  currentUser = null;
  closeNotifPanel();
  body.classList.remove("is-authenticated", "drawer-open");
  appShell.hidden = true;
  loginScreen.hidden = false;
  loginError.hidden = true;
  loginPass.value = "";
  loginUser.focus();
  showSnackbar("Até logo! Sessão encerrada com segurança.", {
    icon: "logout",
    duration: 2800
  });
}

function tryRestoreSession() {
  const id = getSessionId();
  if (!id) return false;
  const user = users.find((item) => item.id === id);
  if (!user) {
    clearSession();
    return false;
  }
  enterApp(user);
  return true;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const identifier = loginUser.value.trim();
  const senhaDigitada = loginPass.value;
  const senhaNormalizada = onlyDigits(senhaDigitada) || senhaDigitada;

  if (!identifier || !senhaDigitada) {
    loginErrorText.textContent = "Preencha RA/usuário e senha.";
    loginError.hidden = false;
    return;
  }

  loginSubmit.disabled = true;
  loginSpinner.hidden = false;
  loginLabel.textContent = "Entrando...";

  // Com banco: a senha é conferida no servidor (bcrypt) e volta um token de sessão
  if (window.EDU_DB && window.EDU_DB.online) {
    window.EDU_DB.login(identifier, senhaDigitada).then((result) => {
      loginSubmit.disabled = false;
      loginSpinner.hidden = true;
      loginLabel.textContent = "Entrar no portal";
      if (!result.ok) {
        loginErrorText.textContent = result.error;
        loginError.hidden = false;
        loginError.focus();
        return;
      }
      users = loadUsers();
      const user = users.find((item) => item.id === result.user.id) || result.user;
      enterApp(user);
    });
    return;
  }

  window.setTimeout(() => {
    const idLower = identifier.toLowerCase();
    const raDigits = onlyDigits(identifier);

    const user = users.find((item) => {
      if (item.role === "admin") {
        return item.login.toLowerCase() === idLower && item.senha === senhaDigitada;
      }

      const sameRa = onlyDigits(item.ra) === raDigits && raDigits.length > 0;
      const samePass =
        onlyDigits(item.senha) === senhaNormalizada || item.senha === senhaDigitada;
      return sameRa && samePass;
    });

    loginSubmit.disabled = false;
    loginSpinner.hidden = true;
    loginLabel.textContent = "Entrar no portal";

    if (!user) {
      loginErrorText.textContent =
        "RA/usuário ou senha inválidos. Professor e Aluno usam RA + CPF.";
      loginError.hidden = false;
      loginError.focus();
      return;
    }

    enterApp(user);
  }, 700);
});

document.querySelectorAll("[data-demo-user]").forEach((btn) => {
  btn.addEventListener("click", () => {
    loginUser.value = btn.dataset.demoUser;
    loginPass.value = btn.dataset.demoPass;
    loginError.hidden = true;
    loginUser.focus();
  });
});

document.getElementById("logoutButton").addEventListener("click", logout);

/* ---------- Navegação ---------- */

function setActiveView(viewId) {
  if (!currentUser) return;

  if (!canAccessView(viewId, currentUser.role)) {
    showSnackbar("Você não tem permissão para esta tela.");
    setActiveView(DEFAULT_HOME[currentUser.role]);
    return;
  }

  document.querySelectorAll(".view").forEach((view) => {
    const active = view.id === `view-${viewId}`;
    view.classList.toggle("is-active", active);
    if (active) view.hidden = false;
    else if (roleAllowed(view, currentUser.role)) view.hidden = true;
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    const active = item.dataset.view === viewId;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  pageTitle.textContent = VIEW_TITLES[viewId] || "Portal Anchieta";
  mainContent.focus({ preventScroll: true });
  if (window.ACADEMIC) ACADEMIC.refreshAll();

  if (window.innerWidth <= 820) closeDrawer();
}

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", () => setActiveView(el.dataset.view));
});

document.querySelectorAll("[data-view-jump]").forEach((el) => {
  el.addEventListener("click", () => setActiveView(el.dataset.viewJump));
});

document.getElementById("goToProfile").addEventListener("click", () => {
  setActiveView("perfil");
});

semesterSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  document.querySelectorAll("[data-semester]").forEach((node) => {
    node.textContent = value;
  });
  showSnackbar(`Semestre ${value} selecionado.`);
});

/* ---------- Usuários (Admin) ---------- */

function updateAdminMetrics() {
  const total = users.length;
  const profs = users.filter((u) => u.role === "professor").length;
  const alunos = users.filter((u) => u.role === "aluno").length;
  const admins = users.filter((u) => u.role === "admin").length;

  const chip = document.getElementById("usersCountChip");
  if (chip) chip.textContent = String(total);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  setText("adminMetricUsers", total);
  setText("adminMetricProfs", profs);
  setText("adminMetricAlunos", alunos);
  setText("adminMetricAdmins", admins);
}

function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  tbody.innerHTML = users
    .map(
      (user) => `
      <tr>
        <td>${user.nome}</td>
        <td>${user.role === "admin" ? "—" : `<code>${user.ra || "—"}</code>`}</td>
        <td><span class="role-badge role-badge--${user.role}">${ROLE_LABELS[user.role]}</span></td>
        <td>${user.role === "admin" ? "—" : maskCpf(user.cpf)}</td>
        <td>
          ${
            user.locked || user.role === "admin"
              ? "<span class='muted'>—</span>"
              : `<button class="btn btn--text" type="button" data-remove-user="${user.id}">Remover</button>`
          }
        </td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll("[data-remove-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.removeUser;
      const target = users.find((u) => u.id === id);
      if (!target || target.locked || target.role === "admin") {
        showSnackbar("Não é possível remover este usuário.");
        return;
      }
      users = users.filter((u) => u.id !== id);
      markSeedRemoved(id);
      unlinkUserFromTurmas(id);
      saveUsers();
      if (window.ACADEMIC) ACADEMIC.refreshAllFromStorage();
      renderUsersTable();
      updateAdminMetrics();
      showSnackbar(`Usuário “${target.nome}” removido.`);
    });
  });

  updateAdminMetrics();
}

function openUserDialog() {
  userForm.reset();
  document.getElementById("newUserRole").value = "professor";
  userDialog.hidden = false;
  document.getElementById("newUserName").focus();
}

function closeUserDialog() {
  userDialog.hidden = true;
}

document.getElementById("openCreateUser").addEventListener("click", openUserDialog);
userDialog.querySelectorAll("[data-user-dialog-close]").forEach((el) => {
  el.addEventListener("click", closeUserDialog);
});

userForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.role !== "admin") {
    showSnackbar("Apenas a Coordenação pode criar usuários.");
    return;
  }

  const nome = document.getElementById("newUserName").value.trim();
  const ra = onlyDigits(document.getElementById("newUserRa").value);
  const cpf = onlyDigits(document.getElementById("newUserCpf").value);
  const role = document.getElementById("newUserRole").value;

  if (!nome || !ra || !cpf) {
    showSnackbar("Preencha Nome Completo, RA e CPF.");
    return;
  }

  if (cpf.length !== 11) {
    showSnackbar("CPF deve ter 11 dígitos (somente números).");
    return;
  }

  if (role !== "professor" && role !== "aluno") {
    showSnackbar("Cargo inválido. Coordenação só cria Professor ou Aluno.");
    return;
  }

  if (users.some((u) => onlyDigits(u.ra) === ra)) {
    showSnackbar("Já existe um usuário com este RA.");
    return;
  }

  const emailLocal = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 2)
    .join(".");

  users.push({
    id: `u-${Date.now()}`,
    nome,
    login: "",
    ra,
    cpf,
    senha: cpf,
    email: `${emailLocal || "usuario"}@anchieta.edu.br`,
    telefone: "",
    role,
    meta: `RA ${ra}`,
    locked: false
  });

  saveUsers();
  renderUsersTable();
  closeUserDialog();
  showSnackbar(`${ROLE_LABELS[role]} “${nome}” criado · RA ${ra} · senha = CPF.`);
});

/* ---------- Turmas Admin (usa ACADEMIC) ---------- */

const turmaDialog = document.getElementById("turmaDialog");
const turmaForm = document.getElementById("turmaForm");

function openTurmaDialog() {
  const professors = users.filter((u) => u.role === "professor");
  const select = document.getElementById("newTurmaProfessor");
  if (!professors.length) {
    showSnackbar("Cadastre um Professor antes de criar turmas.");
    return;
  }
  turmaForm.reset();
  select.innerHTML = ACADEMIC.getProfessorOptionsHtml();
  turmaDialog.hidden = false;
  document.getElementById("newTurmaNome").focus();
}

function closeTurmaDialog() {
  turmaDialog.hidden = true;
}

document.getElementById("openCreateTurma").addEventListener("click", openTurmaDialog);
turmaDialog.querySelectorAll("[data-turma-dialog-close]").forEach((el) => {
  el.addEventListener("click", closeTurmaDialog);
});

turmaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.role !== "admin") {
    showSnackbar("Apenas a Coordenação pode criar turmas.");
    return;
  }

  const nome = document.getElementById("newTurmaNome").value.trim();
  const codigo = document.getElementById("newTurmaCodigo").value.trim().toUpperCase();
  const professorRef = document.getElementById("newTurmaProfessor").value;
  const horario = document.getElementById("newTurmaHorario").value.trim();

  if (!nome || !codigo || !professorRef) {
    showSnackbar("Preencha disciplina, código e professor.");
    return;
  }

  const professor = ACADEMIC.resolveProfessor(professorRef);
  if (!professor) {
    showSnackbar("Professor inválido. Cadastre o professor em Usuários antes.");
    return;
  }

  try {
    ACADEMIC.createTurma({
      nome,
      codigo,
      professorId: professor.id,
      horario
    });
  } catch (err) {
    showSnackbar(err?.message || "Não foi possível criar a turma.");
    return;
  }

  ACADEMIC.refreshAll();
  closeTurmaDialog();
  showSnackbar(
    `Turma "${nome}" vinculada a ${professor.nome} (RA ${professor.ra}). Já aparece em Minhas turmas.`
  );
});

/* ---------- Loading / demos ---------- */

const metricsGrid = document.getElementById("metricsGrid");
const refreshDashboardBtn = document.getElementById("refreshDashboard");

if (refreshDashboardBtn && metricsGrid) {
  refreshDashboardBtn.addEventListener("click", () => {
    refreshDashboardBtn.disabled = true;
    metricsGrid.classList.add("is-loading");
    showSnackbar("Atualizando indicadores...");
    window.setTimeout(() => {
      metricsGrid.classList.remove("is-loading");
      refreshDashboardBtn.disabled = false;
      if (currentUser && window.ACADEMIC) ACADEMIC.refreshAll();
      showSnackbar("Indicadores atualizados.");
    }, 1200);
  });
}

[
  ["demoSnackbar", "Feedback via Snackbar (Melhoria 03)."],
  ["demoSnackbarAudit", "Alteracoes salvas com sucesso! (Melhoria 03)"]
].forEach(([id, msg]) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => showSnackbar(msg));
});

const demoThemeFromAudit = document.getElementById("demoThemeFromAudit");
if (demoThemeFromAudit) {
  demoThemeFromAudit.addEventListener("click", () => themeToggle.click());
}

const showResponsiveTip = document.getElementById("showResponsiveTip");
if (showResponsiveTip) {
  showResponsiveTip.addEventListener("click", () => {
    showSnackbar("DevTools -> 360x800 (Melhoria 05).");
  });
}

const showA11yTip = document.getElementById("showA11yTip");
if (showA11yTip) {
  showA11yTip.addEventListener("click", () => {
    const panel = document.getElementById("a11yTipsPanel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    showSnackbar("Use Tab / Shift+Tab / Enter / Esc (Melhoria 07).");
  });
}

/* ---------- Perfil ---------- */

function setSaving(isSaving) {
  salvarPerfilBtn.disabled = isSaving;
  salvarSpinner.hidden = !isSaving;
  salvarLabel.textContent = isSaving ? "Salvando..." : "Salvar alterações";
}

function validatePerfil() {
  let ok = true;
  const nome = nomeInput.value.trim();
  const email = emailInput.value.trim();
  nomeInput.classList.toggle("is-invalid", nome === "");
  nomeError.hidden = nome !== "";
  if (nome === "") ok = false;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  emailInput.classList.toggle("is-invalid", !emailOk);
  emailError.hidden = emailOk;
  if (!emailOk) ok = false;
  return ok;
}

perfilForm.addEventListener("submit", (event) => {
  event.preventDefault();
  perfilError.hidden = true;
  if (!validatePerfil()) {
    showSnackbar("Revise os campos obrigatórios.");
    return;
  }

  setSaving(true);
  window.setTimeout(() => {
    if (simularErro.checked) {
      setSaving(false);
      perfilError.hidden = false;
      perfilError.focus();
      return;
    }

    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const telefone = telefoneInput.value.trim();

    if (currentUser) {
      currentUser.nome = nome;
      currentUser.email = email;
      currentUser.telefone = telefone;
      users = users.map((u) => (u.id === currentUser.id ? currentUser : u));
      saveUsers();
      syncChrome(currentUser);
    }

    setSaving(false);
    showSnackbar("Alterações salvas com sucesso!");
  }, 2000);
});

document.getElementById("resetPerfil").addEventListener("click", () => {
  if (currentUser) syncChrome(currentUser);
  perfilError.hidden = true;
  nomeInput.classList.remove("is-invalid");
  emailInput.classList.remove("is-invalid");
  nomeError.hidden = true;
  emailError.hidden = true;
  showSnackbar("Edição cancelada.");
});

/* ---------- Ações rápidas / notificações ---------- */

const actionMessages = {
  "segunda-via": "Abrindo a área financeira...",
  grade: "Abrindo sua grade de horários...",
  documentos: "Abrindo a central de documentos...",
  suporte: "Abrindo a central de suporte..."
};

// As ações rápidas do aluno (2ª via, grade, documentos, suporte) estão em servicos.js.
// Este aviso só aparece se o servicos.js não tiver carregado.
document.querySelectorAll(".quick-action").forEach((button) => {
  button.addEventListener("click", () => {
    if (window.SERVICOS) return;
    showSnackbar(actionMessages[button.dataset.action] || "Ação selecionada.");
  });
});

function closeNotifPanel() {
  if (!notifPanel) return;
  notifPanel.hidden = true;
  if (notificationButton) notificationButton.setAttribute("aria-expanded", "false");
}

function openNotifPanel() {
  if (!notifPanel) return;
  refreshNotifications();
  notifPanel.hidden = false;
  if (notificationButton) notificationButton.setAttribute("aria-expanded", "true");
}

function buildNotifications(user) {
  if (!user) return [];

  const title = roleGreetingTitle(user);
  const name = firstName(user.nome);
  const feminine = isFeminineName(user.nome);
  const hello = feminine ? "Bem-vinda" : "Bem-vindo";
  const items = [
    {
      icon: "waving_hand",
      title: `${hello}, ${title} ${name}!`,
      text: "Que bom ter você de volta no Portal Anchieta."
    }
  ];

  if (user.role === "professor" && window.ACADEMIC) {
    const turmas = ACADEMIC.getTurmasDoProfessor(user.id);
    const alunos = turmas.reduce((sum, t) => sum + (t.alunosIds?.length || 0), 0);
    items.push({
      icon: "groups",
      title: turmas.length ? `${turmas.length} turma(s) vinculada(s)` : "Nenhuma turma ainda",
      text: turmas.length
        ? `Você tem ${alunos} aluno(s) para acompanhar em notas, atividades e frequência.`
        : "Assim que o Admin vincular uma turma a você, ela aparece em Minhas turmas."
    });
    items.push({
      icon: "edit_note",
      title: "Lançamentos acadêmicos",
      text: "Use Notas, Atividades e Frequência para manter a turma em dia."
    });
  } else if (user.role === "aluno" && window.ACADEMIC) {
    const turmas = (ACADEMIC.turmas || []).filter((t) => t.alunosIds?.includes(user.id));
    items.push({
      icon: "school",
      title: turmas.length ? `${turmas.length} turma(s) ativa(s)` : "Aguardando vínculo",
      text: turmas.length
        ? "Veja notas, atividades e faltas nas suas turmas."
        : "Quando o professor te vincular a uma turma, os avisos aparecem aqui."
    });
  } else if (user.role === "admin") {
    const professors = users.filter((u) => u.role === "professor").length;
    const alunos = users.filter((u) => u.role === "aluno").length;
    const turmasCount = window.ACADEMIC ? ACADEMIC.turmas.length : 0;
    items.push({
      icon: "account_balance",
      title: "Painel da coordenação",
      text: `${professors} professor(es), ${alunos} aluno(s) e ${turmasCount} turma(s) no portal.`
    });
    items.push({
      icon: "class",
      title: "Dica rápida",
      text: "Crie a turma, vincule o professor e ele já lança notas, provas e faltas."
    });
  }

  return items;
}

function refreshNotifications() {
  if (!notifList) return;
  const items = buildNotifications(currentUser);
  if (notifCountChip) notifCountChip.textContent = String(items.length);
  if (notificationDot) notificationDot.hidden = items.length === 0;

  notifList.innerHTML = items
    .map(
      (item) => `<li class="notif-item">
        <span class="material-symbols-outlined notif-item__icon" aria-hidden="true">${item.icon}</span>
        <div>
          <p class="notif-item__title">${item.title}</p>
          <p class="notif-item__text">${item.text}</p>
        </div>
      </li>`
    )
    .join("");
}

if (notificationButton) {
  notificationButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!notifPanel) return;
    if (notifPanel.hidden) openNotifPanel();
    else closeNotifPanel();
  });
}

document.addEventListener("click", (event) => {
  if (!notifPanel || notifPanel.hidden) return;
  const wrap = event.target.closest(".notif-wrap");
  if (!wrap) closeNotifPanel();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && notifPanel && !notifPanel.hidden) {
    closeNotifPanel();
  }
});

/* ---------- Teclado ---------- */

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!userDialog.hidden) {
    closeUserDialog();
    return;
  }
  if (turmaDialog && !turmaDialog.hidden) {
    closeTurmaDialog();
    return;
  }
  const enrollDialog = document.getElementById("enrollDialog");
  if (enrollDialog && !enrollDialog.hidden && window.ACADEMIC) {
    ACADEMIC.closeEnrollDialog();
    return;
  }
  if (body.classList.contains("drawer-open")) {
    closeDrawer();
    openDrawerBtn.focus();
  }
});

/* ---------- Init ---------- */

if (window.ACADEMIC && !academicBound) {
  ACADEMIC.bindUi();
  academicBound = true;
}

window.addEventListener("storage", (event) => {
  if (event.key === USERS_KEY) {
    reloadEduUsers();
    renderUsersTable();
    updateAdminMetrics();
    if (window.ACADEMIC) ACADEMIC.refreshAll();
  }
  if (event.key === SESSION_KEY && currentUser) {
    const activeId = getSessionId();
    if (activeId && activeId !== currentUser.id) {
      const other = users.find((item) => item.id === activeId);
      if (other) enterApp(other);
    }
  }
});

try {
  const usersChannel = new BroadcastChannel("educonnect-users");
  usersChannel.addEventListener("message", (event) => {
    if (!event?.data || event.data.type !== "users-updated") return;
    reloadEduUsers();
    renderUsersTable();
    updateAdminMetrics();
    if (window.ACADEMIC) ACADEMIC.refreshAll();
  });
} catch {
  /* ignore */
}

if (!tryRestoreSession()) {
  body.classList.remove("is-authenticated");
  appShell.hidden = true;
  loginScreen.hidden = false;
}
