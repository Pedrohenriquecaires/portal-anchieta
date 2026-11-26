/* ============================================================
   Portal Anchieta — 16 slides fullscreen ANTES/DEPOIS + frases
   ============================================================ */

"use strict";

(() => {
  const root = document.getElementById("slidesRoot");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".slide"));

  /* Dentro do próprio modo apresentação não carrega os slides (evita iframes aninhados). */
  if (new URLSearchParams(location.search).get("demo")) {
    root.querySelectorAll("iframe").forEach((f) => f.removeAttribute("src"));
    return;
  }

  /* Selo ANTES/DEPOIS no canto inferior direito (não cobre a barra do portal) */
  const chromeStyle = document.createElement("style");
  chromeStyle.textContent = `
    .slide__chrome { top: auto; left: auto; right: 16px; bottom: 16px; transform: none; }
    .slide-teleprompter { bottom: 72px; }
  `;
  document.head.appendChild(chromeStyle);

    /* DEPOIS = o portal REAL ao vivo (com banco, ações rápidas e dados atuais), em modo
     somente leitura. Cada slide abre a tela correspondente ao ANTES. */
  const DEPOIS_REAL = {
    1: { src: "demo=aluno&view=dashboard", cue: "A mesma tela de dashboard — agora o portal real: métricas, agenda, ações rápidas e dados vindos do banco." },
    3: { src: "demo=aluno&view=aluno-boletim", cue: "A mesma seção de notas — boletim real por disciplina, com média e situação calculadas." },
    5: { src: "demo=aluno&view=dashboard&focus=.quick-grid", cue: "As mesmas ações rápidas — agora funcionam: 2ª via, grade com agenda, documentos e suporte." },
    7: { src: "demo=aluno&view=perfil", cue: "O mesmo perfil — campos com rótulo, validação, loading no botão e Snackbar de confirmação." },
    9: { src: "demo=aluno&view=dashboard", cue: "O mesmo dashboard no celular — menu recolhido, cards em coluna, sem rolagem horizontal." },
    11: { src: "demo=aluno&view=dashboard&theme=light", cue: "A mesma tela no tema claro — o escuro é o padrão; os dois saem dos mesmos tokens." },
    13: { src: "demo=admin&view=admin-home", cue: "O menu muda por cargo — coordenação vê usuários, turmas, chamados e o banco de dados." },
    15: { src: "demo=admin&view=usuarios&dialog=delete", cue: "Ação destrutiva com confirmação — o Dialog aparece antes de qualquer exclusão." }
  };
  slides.forEach((slide) => {
    const cfg = DEPOIS_REAL[Number(slide.dataset.slide)];
    const frame = slide.querySelector("iframe.slide__screen");
    if (!cfg || !frame) return;
    frame.setAttribute("src", `index.html?${cfg.src}&v=apresentacao`);
    frame.setAttribute("loading", "lazy");
    slide.dataset.cue = cfg.cue;
  });
  const counter = document.getElementById("slidesCounter");
  const btnPrev = document.getElementById("slidesPrev");
  const btnNext = document.getElementById("slidesNext");
  const btnClose = document.getElementById("slidesClose");
  const btnCues = document.getElementById("slidesToggleCues");
  const teleprompter = document.getElementById("slideTeleprompter");
  let index = 0;
  let cuesOn = false;

  function syncTeleprompter() {
    if (!teleprompter) return;
    if (!cuesOn) {
      teleprompter.hidden = true;
      teleprompter.textContent = "";
      return;
    }
    const text = slides[index]?.dataset.cue || "";
    teleprompter.textContent = text;
    teleprompter.hidden = !text;
  }

  function bumpIframe(slide) {
    const frame = slide?.querySelector("iframe.slide__screen");
    if (!frame) return;
    // Força recarregar hash/view ao entrar no slide
    const src = frame.getAttribute("src");
    if (!src) return;
    frame.src = src;
  }

  function update() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle("is-active", active);
      if (active) bumpIframe(slide);
    });
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
    if (btnPrev) btnPrev.disabled = index === 0;
    if (btnNext) btnNext.disabled = index === slides.length - 1;
    root.dataset.kind = slides[index]?.dataset.kind || "";
    syncTeleprompter();
  }

  function openSlides(startAt = 0) {
    index = Math.max(0, Math.min(startAt, slides.length - 1));
    root.hidden = false;
    document.body.classList.add("slides-open");
    update();
    btnClose?.focus();
  }

  function closeSlides() {
    root.hidden = true;
    document.body.classList.remove("slides-open");
  }

  function next() {
    if (index < slides.length - 1) {
      index += 1;
      update();
    }
  }

  function prev() {
    if (index > 0) {
      index -= 1;
      update();
    }
  }

  function toggleCues() {
    cuesOn = !cuesOn;
    root.classList.toggle("cues-on", cuesOn);
    if (btnCues) {
      btnCues.setAttribute("aria-pressed", cuesOn ? "true" : "false");
      btnCues.classList.toggle("is-active-cue", cuesOn);
    }
    syncTeleprompter();
  }

  btnPrev?.addEventListener("click", prev);
  btnNext?.addEventListener("click", next);
  btnClose?.addEventListener("click", closeSlides);
  btnCues?.addEventListener("click", toggleCues);

  document.getElementById("openSlidesFullscreen")?.addEventListener("click", () => openSlides(0));
  document.getElementById("openSlidesFromLogin")?.addEventListener("click", () => openSlides(0));

  document.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if (event.key === "Escape") {
      closeSlides();
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      toggleCues();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      next();
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      prev();
    }
  });

  window.EduSlides = { open: openSlides, close: closeSlides, toggleCues };
})();
