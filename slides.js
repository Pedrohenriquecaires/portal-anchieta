/* ============================================================
   Portal Anchieta — 16 slides fullscreen ANTES/DEPOIS + frases
   ============================================================ */

"use strict";

(() => {
  const root = document.getElementById("slidesRoot");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".slide"));
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
