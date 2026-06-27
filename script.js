// ── 5 pages (adjust if you add more) ──────────────────────────────────────
const pages = [
  { image: "assets/pages/1.png" },
  { image: "assets/pages/2.png" },
  { image: "assets/pages/3.png" },
  { image: "assets/pages/4.png" },
  { image: "assets/pages/5.png" },
  { image: "assets/pages/6.png" },
];

// ── DOM refs ───────────────────────────────────────────────────────────────
const book             = document.querySelector("#book");
const leftPage         = document.querySelector(".left-page");
const rightPage        = document.querySelector(".right-page");
const previousButton   = document.querySelector("#prevPage");
const nextButton       = document.querySelector("#nextPage");
const progressBar      = document.querySelector("#progressBar");
const leftMedia        = document.querySelector("#leftMedia");
const rightMedia       = document.querySelector("#rightMedia");
const turnSheet        = document.querySelector(".turn-sheet");
const turnFront        = document.querySelector(".turn-front");
const turnFrontMedia   = document.querySelector(".turn-front-media");
const welcomeModal     = document.querySelector("#welcomeModal");
const closeWelcomeBtn  = document.querySelector("#closeWelcome");

// ── Constants ──────────────────────────────────────────────────────────────
const TURN_DURATION    = 700;
const CANCEL_DURATION  = 340;
const DRAG_THRESHOLD   = 10;
const COMMIT_THRESHOLD = 0.25;
const MAX_ANGLE        = 188;   // go past 90° so back-face shows cleanly

// ── State ──────────────────────────────────────────────────────────────────
let currentSpread = 0;
let isTurning     = false;
let dragState     = null;

// ── Layout helpers ─────────────────────────────────────────────────────────
function totalSpreads() {
  return Math.ceil(pages.length / 2);
}

/**
 * Returns true when we should show only one page at a time.
 * Portrait phones → single page.
 * Landscape phones keep the two-page spread (like desktop).
 */
function isSinglePage() {
  return window.matchMedia(
    "(max-width: 600px) and (orientation: portrait)"
  ).matches;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Image helpers ──────────────────────────────────────────────────────────
function setImage(el, page) {
  if (page?.image) {
    el.style.backgroundImage = `url("${page.image}")`;
    el.classList.add("has-image");
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("has-image");
  }
}

// ── Update visible pages ───────────────────────────────────────────────────
function updatePages() {
  const li = currentSpread * 2;       // left-page index
  const ri = li + 1;                  // right-page index

  // In single-page mode both slots show the same page
  setImage(leftMedia,  pages[li]);
  setImage(rightMedia, pages[isSinglePage() ? li : ri]);

  previousButton.disabled = currentSpread === 0;
  nextButton.disabled     = currentSpread >= totalSpreads() - 1;
  progressBar.style.width = `${((currentSpread + 1) / totalSpreads()) * 100}%`;
}

function canTurn(dir) {
  const next = currentSpread + dir;
  return next >= 0 && next < totalSpreads();
}

/** Which page image goes on the front face of the turning sheet */
function pageForTurn(dir) {
  const li = currentSpread * 2;
  const ri = li + 1;
  if (isSinglePage()) return pages[li];
  return dir > 0 ? pages[ri] : pages[li];
}

function pageWidthForTurn() {
  const r = book.getBoundingClientRect();
  return isSinglePage() ? r.width : (r.width - 22) / 2;
}

// ── 3D turn progress ───────────────────────────────────────────────────────
/**
 * progress 0 → resting  (0°)
 * progress 1 → fully flipped (MAX_ANGLE)
 *
 * Phase 1 (0–0.5): ease-in from 0° → 90°  (page lifting away)
 * Phase 2 (0.5–1): ease-out from 90° → MAX_ANGLE  (page landing)
 *
 * TranslateZ arcs up to ~32 px at progress 0.45 (peak lift).
 */
function setTurnProgress(progress, dir) {
  let angle;
  if (progress <= 0.5) {
    const t = progress * 2;                    // 0→1
    angle = t * t * 90;                        // ease-in to 90°
  } else {
    const t = (progress - 0.5) * 2;           // 0→1
    angle = 90 + (1 - (1 - t) * (1 - t)) * (MAX_ANGLE - 90); // ease-out to MAX
  }

  const lift = 4 + Math.sin(progress * Math.PI) * 32;
  const finalAngle = dir > 0 ? -angle : angle;

  turnSheet.style.transform = `rotateY(${finalAngle}deg) translateZ(${lift}px)`;

  // dynamic shadow on front face
  if (turnFront) {
    const liftFrac  = Math.sin(progress * Math.PI);
    const sh        = Math.round(liftFrac * 18);
    const blur      = Math.round(12 + liftFrac * 28);
    const alpha     = (0.10 + liftFrac * 0.20).toFixed(2);
    turnFront.style.boxShadow =
      `${dir > 0 ? -sh : sh}px 0 ${blur}px rgba(121,87,111,${alpha})`;
  }
}

// ── Turn lifecycle ─────────────────────────────────────────────────────────
function prepareTurn(dir) {
  isTurning = true;
  setImage(turnFrontMedia, pageForTurn(dir));
  setTurnProgress(0, dir);

  turnSheet.className = "turn-sheet is-active";
  if (dir < 0) turnSheet.classList.add("is-backward");
  if (isSinglePage()) turnSheet.classList.add("is-single");
}

function clearTurn() {
  turnSheet.className = "turn-sheet";
  turnSheet.style.transform    = "";
  turnSheet.style.transition   = "";
  if (turnFront) turnFront.style.boxShadow = "";
  setImage(turnFrontMedia, null);
  isTurning = false;
}

function finishTurn(dir, shouldComplete) {
  const duration = shouldComplete ? TURN_DURATION : CANCEL_DURATION;

  turnSheet.style.transition =
    `transform ${duration}ms cubic-bezier(0.165, 0.84, 0.44, 1)`;

  // rAF to ensure transition is registered before the final value is set
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTurnProgress(shouldComplete ? 1 : 0, dir);
    });
  });

  setTimeout(() => {
    if (shouldComplete) {
      currentSpread += dir;
      updatePages();
    }
    clearTurn();
  }, duration + 20);
}

function animateTurn(dir) {
  if (isTurning || !canTurn(dir)) return;
  prepareTurn(dir);
  // let the browser paint the starting state first
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      finishTurn(dir, true);
    });
  });
}

// ── Drag / swipe ───────────────────────────────────────────────────────────
function directionFromDrag(sourcePage, deltaX) {
  if (Math.abs(deltaX) < DRAG_THRESHOLD) return 0;
  if (isSinglePage()) return deltaX < 0 ? 1 : -1;
  if (sourcePage === rightPage && deltaX < 0) return  1;
  if (sourcePage === leftPage  && deltaX > 0) return -1;
  return 0;
}

function startDrag(e) {
  if (isTurning) return;
  dragState = {
    direction:  0,
    pointerId:  e.pointerId,
    progress:   0,
    sourcePage: e.currentTarget,
    startX:     e.clientX,
    startY:     e.clientY,
  };
  e.currentTarget.classList.add("is-grabbing");
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
}

function moveDrag(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();

  if (!dragState.direction) {
    const dir = directionFromDrag(dragState.sourcePage, dx);
    if (!dir || !canTurn(dir)) return;
    dragState.direction = dir;
    prepareTurn(dir);
  }

  const width = pageWidthForTurn();
  const raw   = dragState.direction > 0 ? -dx / width : dx / width;
  dragState.progress = clamp(raw, 0, 1);
  setTurnProgress(dragState.progress, dragState.direction);
}

function endDrag() {
  if (!dragState) return;
  dragState.sourcePage.classList.remove("is-grabbing");
  if (!dragState.direction) { dragState = null; return; }
  const dir           = dragState.direction;
  const shouldComplete = dragState.progress >= COMMIT_THRESHOLD;
  dragState = null;
  finishTurn(dir, shouldComplete);
}

// ── Event listeners ────────────────────────────────────────────────────────
previousButton.addEventListener("click", () => animateTurn(-1));
nextButton.addEventListener("click",     () => animateTurn(1));

closeWelcomeBtn.addEventListener("click", () => {
  welcomeModal.classList.add("is-hidden");
});
welcomeModal.addEventListener("click", (e) => {
  if (e.target === welcomeModal) welcomeModal.classList.add("is-hidden");
});

[leftPage, rightPage].forEach((p) => p.addEventListener("pointerdown", startDrag));
window.addEventListener("pointermove",   moveDrag, { passive: false });
window.addEventListener("pointerup",     endDrag);
window.addEventListener("pointercancel", endDrag);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape")     welcomeModal.classList.add("is-hidden");
  if (e.key === "ArrowLeft")  animateTurn(-1);
  if (e.key === "ArrowRight") animateTurn(1);
});

window.addEventListener("resize", updatePages);

// ── Init ───────────────────────────────────────────────────────────────────
updatePages();
