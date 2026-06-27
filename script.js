const pages = [
  { image: "assets/pages/1.png" },
  { image: "assets/pages/2.png" },
  { image: "assets/pages/3.png" },
  { image: "assets/pages/4.png" },
  { image: "assets/pages/5.png" },
  { image: "assets/pages/6.png" },
];

const book          = document.querySelector("#book");
const leftPage      = document.querySelector(".left-page");
const rightPage     = document.querySelector(".right-page");
const previousButton = document.querySelector("#prevPage");
const nextButton    = document.querySelector("#nextPage");
const progressBar   = document.querySelector("#progressBar");
const leftMedia     = document.querySelector("#leftMedia");
const rightMedia    = document.querySelector("#rightMedia");
const turnSheet     = document.querySelector(".turn-sheet");
const welcomeModal  = document.querySelector("#welcomeModal");
const closeWelcomeButton = document.querySelector("#closeWelcome");

// Turn sheet now has two faces
const turnFront      = document.querySelector(".turn-front");
const turnFrontMedia = document.querySelector(".turn-front-media");
const turnBack       = document.querySelector(".turn-back");

const TURN_DURATION    = 680;
const CANCEL_DURATION  = 340;
const DRAG_THRESHOLD   = 10;
const COMMIT_THRESHOLD = 0.25;

// Max rotation — go slightly past 90° so backface is clearly visible
const MAX_ANGLE = 185;

let currentSpread = 0;
let isTurning     = false;
let dragState     = null;

/* ── helpers ── */

function totalSpreads() {
  return Math.ceil(pages.length / 2);
}

function isSinglePage() {
  // Single-page mode: portrait mobile OR landscape with very small height
  return window.matchMedia("(max-width: 760px) and (orientation: portrait)").matches
      || window.matchMedia("(max-height: 520px) and (orientation: landscape) and (max-width: 520px)").matches;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function setImage(el, page) {
  if (page?.image) {
    el.style.backgroundImage = `url("${page.image}")`;
    el.classList.add("has-image");
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("has-image");
  }
}

/* ── page state ── */

function updatePages() {
  const li = currentSpread * 2;
  const ri = li + 1;

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

/* Which page image goes on the turning sheet's front face */
function pageForTurn(dir) {
  const li = currentSpread * 2;
  const ri = li + 1;
  if (isSinglePage()) return pages[li];
  return dir > 0 ? pages[ri] : pages[li];
}

function pageWidthForTurn() {
  const rect = book.getBoundingClientRect();
  return isSinglePage() ? rect.width : (rect.width - 22) / 2;
}

/* ── 3D turn progress ──
   progress 0 → at rest
   progress 1 → fully flipped (past 90°, back face showing)

   We use a two-phase easing:
     0–0.5  : accelerate from 0° to 90°   (fold)
     0.5–1  : decelerate from 90° to 185° (land)

   The "lift" adds a translateZ arc that peaks at 90°.
*/
function setTurnProgress(progress, dir) {
  // Smooth S-curve angle
  const halfAngle = 90;
  let angle;
  if (progress <= 0.5) {
    // ease-in quadratic to 90°
    angle = 2 * progress * progress * halfAngle;
  } else {
    // ease-out quadratic from 90° to MAX_ANGLE
    const t = (progress - 0.5) * 2;
    angle = halfAngle + (1 - (1 - t) * (1 - t)) * (MAX_ANGLE - halfAngle);
  }

  // lift: peaks around progress 0.45
  const liftCurve = Math.sin(progress * Math.PI);
  const lift = 4 + liftCurve * 28;

  // shadow opacity follows lift
  const shadowOpacity = 0.15 + liftCurve * 0.25;

  const finalAngle = dir > 0 ? -angle : angle;

  turnSheet.style.setProperty("--turn-angle", `${finalAngle}deg`);
  turnSheet.style.transform = `rotateY(${finalAngle}deg) translateZ(${lift}px)`;
  turnSheet.style.setProperty("--shadow-opacity", shadowOpacity);

  // Dynamic box-shadow on the front face to simulate page-lift shadow
  if (turnFront) {
    const sh = Math.round(liftCurve * 22);
    const blur = Math.round(10 + liftCurve * 32);
    turnFront.style.boxShadow = `${dir > 0 ? -sh : sh}px 0 ${blur}px rgba(121,87,111,${shadowOpacity})`;
  }
}

/* ── turn lifecycle ── */

function prepareTurn(dir) {
  isTurning = true;

  // Set front-face image
  setImage(turnFrontMedia, pageForTurn(dir));

  setTurnProgress(0, dir);

  turnSheet.className = "turn-sheet is-active";
  if (dir < 0) turnSheet.classList.add("is-backward");
  if (isSinglePage()) turnSheet.classList.add("is-single");
}

function clearTurn() {
  turnSheet.className = "turn-sheet";
  turnSheet.style.transform = "";
  turnSheet.style.transition = "";
  setImage(turnFrontMedia, null);
  if (turnFront) turnFront.style.boxShadow = "";
  isTurning = false;
}

function finishTurn(dir, shouldComplete) {
  const duration = shouldComplete ? TURN_DURATION : CANCEL_DURATION;

  // Apply CSS transition for the settling animation
  turnSheet.style.transition = `transform ${duration}ms cubic-bezier(0.165, 0.84, 0.44, 1)`;

  // Animate to final state
  requestAnimationFrame(() => {
    setTurnProgress(shouldComplete ? 1 : 0, dir);
  });

  window.setTimeout(() => {
    if (shouldComplete) {
      currentSpread += dir;
      updatePages();
    }
    clearTurn();
  }, duration);
}

function animateTurn(dir) {
  if (isTurning || !canTurn(dir)) return;

  prepareTurn(dir);

  // Small delay so the prepareTurn paint lands first
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      finishTurn(dir, true);
    });
  });
}

/* ── drag ── */

function directionFromDrag(sourcePage, deltaX) {
  if (Math.abs(deltaX) < DRAG_THRESHOLD) return 0;

  if (isSinglePage()) return deltaX < 0 ? 1 : -1;

  if (sourcePage === rightPage && deltaX < 0) return 1;
  if (sourcePage === leftPage  && deltaX > 0) return -1;
  return 0;
}

function startDrag(event) {
  if (isTurning) return;

  dragState = {
    direction:  0,
    pointerId:  event.pointerId,
    progress:   0,
    sourcePage: event.currentTarget,
    startX:     event.clientX,
    startY:     event.clientY,
  };

  event.currentTarget.classList.add("is-grabbing");

  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch (_) { /* noop */ }
}

function moveDrag(event) {
  if (!dragState) return;

  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    event.preventDefault();
  }

  if (!dragState.direction) {
    const dir = directionFromDrag(dragState.sourcePage, deltaX);
    if (!dir || !canTurn(dir)) return;
    dragState.direction = dir;
    prepareTurn(dir);
  }

  const width    = pageWidthForTurn();
  const raw      = dragState.direction > 0 ? -deltaX / width : deltaX / width;
  dragState.progress = clamp(raw, 0, 1);
  setTurnProgress(dragState.progress, dragState.direction);
}

function endDrag() {
  if (!dragState) return;

  dragState.sourcePage.classList.remove("is-grabbing");

  if (!dragState.direction) {
    dragState = null;
    return;
  }

  const dir           = dragState.direction;
  const shouldComplete = dragState.progress >= COMMIT_THRESHOLD;
  dragState = null;
  finishTurn(dir, shouldComplete);
}

/* ── events ── */

previousButton.addEventListener("click", () => animateTurn(-1));
nextButton.addEventListener("click",     () => animateTurn(1));

closeWelcomeButton.addEventListener("click", () => {
  welcomeModal.classList.add("is-hidden");
});

welcomeModal.addEventListener("click", (e) => {
  if (e.target === welcomeModal) welcomeModal.classList.add("is-hidden");
});

[leftPage, rightPage].forEach((p) => {
  p.addEventListener("pointerdown", startDrag);
});

window.addEventListener("pointermove",   moveDrag, { passive: false });
window.addEventListener("pointerup",     endDrag);
window.addEventListener("pointercancel", endDrag);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape")     welcomeModal.classList.add("is-hidden");
  if (e.key === "ArrowLeft")  animateTurn(-1);
  if (e.key === "ArrowRight") animateTurn(1);
});

window.addEventListener("resize", updatePages);

updatePages();
