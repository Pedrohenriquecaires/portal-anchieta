/* ============================================================
   Portal Anchieta — effects.js
   Movimento com propósito (Material Motion):
   1. Reveal: blocos aparecem em sequência ao entrar na tela
   2. Ripple: resposta visual imediata ao toque/clique
   3. (removido) brilho dentro de cards — o DESIGN.md reserva brilhos ao hero/fundo
   4. Contadores: métricas sobem de 0 até o valor real
   5. Icon buttons que expandem e mostram o rótulo
   6. App bar com elevação ao rolar + barra de progresso
   7. FAB "Voltar ao topo"
   Tudo respeita prefers-reduced-motion e não altera a lógica do portal.
   ============================================================ */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionOn = () => !reducedMotion.matches;

  /* ---------- 1. REVEAL ---------- */

  const REVEAL_SELECTOR = [
    ".page-intro",
    ".campus-hero",
    ".metric",
    ".split-grid > .panel",
    ".view > .panel",
    ".view > .card",
    ".view > .empty-state",
    ".disc-list > .card",
    ".disc-list > .empty-state",
    ".quick-action",
    ".improve-card",
    ".event",
    ".checklist li",
    ".mini-list li"
  ].join(",");

  const STAGGER = 70;
  const MAX_STAGGER = 9;

  const revealObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );

      visible.forEach((el, index) => {
        el.style.setProperty("--reveal-delay", `${Math.min(index, MAX_STAGGER) * STAGGER}ms`);
        el.classList.add("is-visible");
        revealObserver.unobserve(el);
        if (el.classList.contains("metric")) animateMetric(el);
        // Libera o delay depois da entrada, para que hovers respondam na hora.
        window.setTimeout(() => {
          el.style.removeProperty("--reveal-delay");
        }, 900 + Math.min(index, MAX_STAGGER) * STAGGER);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
  );

  function collect(root) {
    const list = [];
    if (root.nodeType !== 1) return list;
    if (root.matches(REVEAL_SELECTOR)) list.push(root);
    root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => list.push(el));
    return list;
  }

  function prime(root) {
    if (!motionOn()) return;
    collect(root).forEach((el) => {
      if (el.closest(".slides-root, .dialog-root, .notif-panel")) return;
      el.classList.remove("is-visible");
      el.classList.add("reveal");
      revealObserver.unobserve(el);
      revealObserver.observe(el);
    });
  }

  // Animar só quando a tela muda (troca de view / login).
  // Re-renderizações por ação (ex.: excluir item) não "piscam" a lista inteira.
  let animateUntil = 0;
  const openWindow = (ms = 900) => {
    animateUntil = performance.now() + ms;
  };

  const domObserver = new MutationObserver((records) => {
    // 1º: mudanças de classe/visibilidade (view ativa, app aberto)
    records.forEach((record) => {
      if (record.type !== "attributes") return;
      const el = record.target;

      if (el.classList.contains("view") && record.attributeName === "class") {
        if (el.classList.contains("is-active")) {
          openWindow();
          prime(el);
        }
      }

      if (el.id === "appShell" && record.attributeName === "hidden" && !el.hidden) {
        openWindow(1200);
      }

      if (el.id === "metricsGrid" && record.attributeName === "class") {
        if (!el.classList.contains("is-loading") && record.oldValue?.includes("is-loading")) {
          // Após o "Atualizar", os números sobem de novo.
          window.setTimeout(() => el.querySelectorAll(".metric").forEach(animateMetric), 30);
        }
      }

      if (el.id === "themeToggle" && record.attributeName === "aria-label") {
        syncExpandLabel(el);
      }
    });

    // 2º: conteúdo novo renderizado pelo academic.js
    if (performance.now() > animateUntil) return;
    records.forEach((record) => {
      if (record.type !== "childList") return;
      record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (!node.closest(".view.is-active")) return;
        prime(node);
      });
    });
  });

  /* ---------- 4. CONTADORES ---------- */

  const counterRuns = new WeakMap();

  function animateMetric(metric) {
    if (!motionOn()) return;
    const valueEl = metric.querySelector(".metric__value");
    if (!valueEl) return;
    const raw = valueEl.textContent.trim();
    const match = raw.match(/^(-?\d+)([.,](\d+))?$/);
    if (!match) return;

    const decimals = match[3] ? match[3].length : 0;
    const separator = match[2] ? match[2][0] : ",";
    const target = parseFloat(raw.replace(",", "."));
    if (!isFinite(target) || target === 0) return;

    if (valueEl.dataset.counting === "1") return;
    valueEl.dataset.counting = "1";
    window.setTimeout(() => delete valueEl.dataset.counting, 1000);
    const runId = (counterRuns.get(valueEl) || 0) + 1;
    counterRuns.set(valueEl, runId);

    const duration = 900;
    const start = performance.now();
    let lastWritten = null;

    const format = (n) => n.toFixed(decimals).replace(".", separator);

    const step = () => {
      if (counterRuns.get(valueEl) !== runId) return;
      // Se outro script trocou o valor no meio, respeitamos o novo valor.
      if (lastWritten !== null && valueEl.textContent !== lastWritten) return;
      // performance.now() (e não o timestamp do rAF): o relógio do rAF pode
      // estar atrás em iframes recarregados, o que gerava t negativo.
      const t = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      lastWritten = t < 1 ? format(target * eased) : raw;
      valueEl.textContent = lastWritten;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- 2. RIPPLE ---------- */

  const RIPPLE_SELECTOR =
    ".btn, .icon-btn, .nav-item, .quick-action, .login-demo, .chip--action, .profile-chip, .fab";

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!motionOn() || event.button !== 0) return;
      const target = event.target.closest(RIPPLE_SELECTOR);
      if (!target || target.disabled) return;

      const rect = target.getBoundingClientRect();
      const size = Math.hypot(rect.width, rect.height) * 2;
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.setAttribute("aria-hidden", "true");
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

      if (getComputedStyle(target).position === "static") target.style.position = "relative";
      target.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    },
    { passive: true }
  );

  /* ---------- 5. ICON BUTTONS QUE EXPANDEM ---------- */

  function labelFromAria(button) {
    const aria = button.getAttribute("aria-label") || "";
    const text = aria.replace(/^Ativar\s+/i, "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function syncExpandLabel(button) {
    const label = button.querySelector(".icon-btn__label");
    if (label) label.textContent = labelFromAria(button);
  }

  ["themeToggle", "notificationButton"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button || button.querySelector(".icon-btn__label")) return;
    const label = document.createElement("span");
    label.className = "icon-btn__label";
    label.setAttribute("aria-hidden", "true");
    button.classList.add("icon-btn--expand");
    button.appendChild(label);
    syncExpandLabel(button);
  });

  /* ---------- 6. APP BAR + 7. FAB ---------- */

  const appBar = document.getElementById("appBar");
  const progress = document.getElementById("scrollProgress");
  const fab = document.getElementById("backToTop");

  let scrollFrame = 0;
  function onScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (appBar) appBar.classList.toggle("is-scrolled", y > 8);
      if (progress) progress.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
      if (fab) {
        const show = y > 420;
        fab.classList.toggle("is-visible", show);
        fab.tabIndex = show ? 0 : -1;
        fab.setAttribute("aria-hidden", show ? "false" : "true");
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  if (fab) {
    fab.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: motionOn() ? "smooth" : "auto" });
      document.getElementById("conteudo-principal")?.focus({ preventScroll: true });
    });
  }

  /* ---------- Extras de feedback ---------- */

  // Cartão de demo escolhido fica marcado (o usuário vê o que preencheu)
  document.querySelectorAll(".login-demo").forEach((demo) => {
    demo.addEventListener("click", () => {
      document.querySelectorAll(".login-demo").forEach((d) => d.classList.remove("is-picked"));
      demo.classList.add("is-picked");
    });
  });

  // Barra de tempo do Snackbar reinicia a cada nova mensagem
  if (typeof window.showSnackbar === "function") {
    const originalShow = window.showSnackbar;
    const snackbar = document.getElementById("snackbar");
    window.showSnackbar = function (message, options = {}) {
      if (snackbar) {
        snackbar.style.setProperty("--snack-duration", `${options.duration || 3200}ms`);
        snackbar.classList.remove("is-open");
        void snackbar.offsetWidth;
      }
      return originalShow.call(this, message, options);
    };
  }

  /* ---------- Confirmação de exclusão (Desafio C) ----------
     Intercepta botões destrutivos antes da lógica original:
     abre o Dialog; só ao confirmar o clique original é repetido. */

  const DESTRUCTIVE = {
    "data-remove-user": "Este usuário",
    "data-remove-turma": "Esta turma",
    "data-remove-atividade": "Esta atividade",
    "data-remove-prova": "Esta prova",
    "data-remove-falta": "Este registro de falta",
    "data-unlink-aluno": "O vínculo deste aluno com a turma",
    "data-reset-db": "O conteúdo atual do banco"
  };
  const DESTRUCTIVE_SELECTOR = Object.keys(DESTRUCTIVE)
    .map((attr) => `[${attr}]`)
    .join(",");

  const deleteDialog = document.getElementById("deleteDialog");
  const deleteName = document.getElementById("deleteDialogName");
  const confirmDelete = document.getElementById("confirmDelete");
  let pendingButton = null;
  let confirmedButton = null;
  let lastFocus = null;

  function describeTarget(button) {
    const attr = Object.keys(DESTRUCTIVE).find((a) => button.hasAttribute(a));
    if (attr === "data-reset-db") return DESTRUCTIVE[attr];
    const row = button.closest("tr, li, article");
    const title =
      row?.querySelector("h3")?.textContent ||
      row?.querySelector("td")?.textContent ||
      row?.querySelector("span")?.textContent ||
      "";
    const clean = title.trim().replace(/\s+/g, " ");
    return clean ? `“${clean.slice(0, 60)}”` : DESTRUCTIVE[attr];
  }

  function openDeleteDialog(button) {
    pendingButton = button;
    lastFocus = document.activeElement;
    if (deleteName) deleteName.textContent = describeTarget(button);
    deleteDialog.hidden = false;
    confirmDelete?.focus();
  }

  function closeDeleteDialog() {
    deleteDialog.hidden = true;
    pendingButton = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  if (deleteDialog && confirmDelete) {
    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest(DESTRUCTIVE_SELECTOR);
        if (!button) return;
        if (button === confirmedButton) {
          confirmedButton = null;
          return; // segue para a lógica original
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        openDeleteDialog(button);
      },
      true
    );

    confirmDelete.addEventListener("click", () => {
      const button = pendingButton;
      deleteDialog.hidden = true;
      pendingButton = null;
      if (button && document.contains(button)) {
        confirmedButton = button;
        button.click();
      }
    });

    deleteDialog.querySelectorAll("[data-dialog-close]").forEach((el) => {
      el.addEventListener("click", closeDeleteDialog);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !deleteDialog.hidden) closeDeleteDialog();
      // Mantém o foco dentro do dialog (Tab / Shift+Tab)
      if (event.key === "Tab" && !deleteDialog.hidden) {
        const focusables = [...deleteDialog.querySelectorAll("button")];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* ---------- Inicialização ---------- */

  domObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["class", "hidden", "aria-label"]
  });

  // Estado inicial (sessão restaurada antes deste script carregar)
  const activeView = document.querySelector(".view.is-active");
  if (activeView) {
    openWindow();
    prime(activeView);
  }
  onScroll();
})();
