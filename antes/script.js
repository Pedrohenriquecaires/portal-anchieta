/* ============================================================
   EDUCONNECT — COMPORTAMENTOS DE INTERAÇÃO
   JavaScript puro (sem frameworks)
   ============================================================ */

"use strict";

/* ------------------------------------------------------------
   1. REFERÊNCIAS AO DOM
   ------------------------------------------------------------ */
const body = document.body;

const sidebar = document.getElementById("sidebar");
const openSidebarButton = document.getElementById("openSidebar");
const closeSidebarButton = document.getElementById("closeSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const themeToggle = document.getElementById("themeToggle");
const semesterSelect = document.getElementById("semesterSelect");

const notificationButton = document.getElementById("notificationButton");
const logoutButton = document.getElementById("logoutButton");
const openQuickActionsButton = document.getElementById("openQuickActions");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");

const quickActions = document.querySelectorAll(".quick-action");
const semesterLabels = document.querySelectorAll("[data-semester]");

/* ------------------------------------------------------------
   2. TOAST / FEEDBACK
   Mostra uma mensagem curta e não bloqueante.
   ------------------------------------------------------------ */
let toastTimer;

function showToast(message) {
  // Atualiza o texto do toast.
  toastMessage.textContent = message;

  // Torna o toast visível.
  toast.classList.add("toast--visible");

  // Cancela qualquer temporizador anterior para evitar conflito.
  window.clearTimeout(toastTimer);

  // Oculta novamente após alguns segundos.
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 2800);
}

/* ------------------------------------------------------------
   3. MENU RESPONSIVO
   ------------------------------------------------------------ */
function openSidebar() {
  body.classList.add("sidebar-open");

  // aria-expanded informa o estado do menu para tecnologias assistivas.
  openSidebarButton.setAttribute("aria-expanded", "true");

  // Leva o foco para o botão de fechar.
  // Isso torna a navegação por teclado mais previsível.
  closeSidebarButton.focus();
}

function closeSidebar() {
  body.classList.remove("sidebar-open");
  openSidebarButton.setAttribute("aria-expanded", "false");
}

openSidebarButton.addEventListener("click", openSidebar);
closeSidebarButton.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

/* Fechar o menu com a tecla ESC é um padrão de interação esperado. */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && body.classList.contains("sidebar-open")) {
    closeSidebar();
    openSidebarButton.focus();
  }
});

/* Se o usuário voltar para desktop, removemos o estado do menu mobile. */
window.addEventListener("resize", () => {
  if (window.innerWidth > 820) {
    closeSidebar();
  }
});

/* ------------------------------------------------------------
   4. TEMA CLARO / ESCURO
   localStorage preserva a preferência do usuário.
   ------------------------------------------------------------ */
const savedTheme = localStorage.getItem("educonnect-theme");

if (savedTheme === "dark" || savedTheme === "light") {
  body.dataset.theme = savedTheme;
}

function updateThemeButtonLabel() {
  const currentTheme = body.dataset.theme === "dark" ? "dark" : "light";

  themeToggle.setAttribute(
    "aria-label",
    currentTheme === "dark"
      ? "Ativar tema claro"
      : "Ativar tema escuro"
  );
}

updateThemeButtonLabel();

themeToggle.addEventListener("click", () => {
  const isDark = body.dataset.theme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  body.dataset.theme = nextTheme;
  localStorage.setItem("educonnect-theme", nextTheme);

  updateThemeButtonLabel();

  showToast(
    nextTheme === "dark"
      ? "Tema escuro ativado."
      : "Tema claro ativado."
  );
});

/* ------------------------------------------------------------
   5. TROCA DE SEMESTRE
   Demonstra como componentes diferentes podem reagir
   a uma mesma alteração de estado.
   ------------------------------------------------------------ */
semesterSelect.addEventListener("change", (event) => {
  const selectedSemester = event.target.value;

  semesterLabels.forEach((label) => {
    label.textContent = selectedSemester;
  });

  showToast(`Semestre ${selectedSemester} selecionado.`);
});

/* ------------------------------------------------------------
   6. AÇÕES RÁPIDAS
   Em um sistema real, estes botões poderiam navegar para telas,
   abrir modais ou chamar uma API.
   ------------------------------------------------------------ */
const actionMessages = {
  "segunda-via": "Abrindo a área financeira...",
  grade: "Abrindo sua grade de horários...",
  documentos: "Abrindo a central de documentos...",
  suporte: "Abrindo a central de suporte..."
};

quickActions.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    showToast(actionMessages[action] ?? "Ação selecionada.");
  });
});

/* Botão do hero leva o usuário até a seção de atalhos. */
openQuickActionsButton.addEventListener("click", () => {
  const quickActionsPanel = document.querySelector(".quick-actions-panel");

  quickActionsPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

/* ------------------------------------------------------------
   7. NOTIFICAÇÕES / LOGOUT
   Feedback demonstrativo para o protótipo.
   ------------------------------------------------------------ */
notificationButton.addEventListener("click", () => {
  showToast("Você tem 2 notificações acadêmicas novas.");
});

logoutButton.addEventListener("click", () => {
  // Evita um logout real neste protótipo acadêmico.
  showToast("Protótipo: ação de logout acionada.");
});

/* ------------------------------------------------------------
   8. FECHAMENTO AUTOMÁTICO DO MENU MOBILE
   Quando o usuário seleciona um item do menu, fechamos a sidebar.
   ------------------------------------------------------------ */
document.querySelectorAll(".sidebar a").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 820) {
      closeSidebar();
    }
  });
});
