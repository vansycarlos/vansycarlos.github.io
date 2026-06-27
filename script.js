const pages = [
  { image: "assets/pages/1.png" },
  { image: "assets/pages/2.png" },
  { image: "assets/pages/3.png" },
  { image: "assets/pages/4.png" },
  { image: "assets/pages/5.png" },
  { image: "assets/pages/6.png" },
];

const book = document.querySelector("#book");
const leftPage = document.querySelector(".left-page");
const rightPage = document.querySelector(".right-page");
const previousButton = document.querySelector("#prevPage");
const nextButton = document.querySelector("#nextPage");
const progressBar = document.querySelector("#progressBar");
const leftMedia = document.querySelector("#leftMedia");
const rightMedia = document.querySelector("#rightMedia");
const turnSheet = document.querySelector(".turn-sheet");
const turnMedia = document.querySelector("#turnMedia");
const welcomeModal = document.querySelector("#welcomeModal");
const closeWelcomeButton = document.querySelector("#closeWelcome");

const turnDuration = 620;
const cancelDuration = 320;
const dragStartThreshold = 10;
const commitThreshold = 0.28;

let currentSpread = 0;
let isTurning = false;
let dragState = null;

function totalSpreads() {
  return Math.ceil(pages.length / 2);
}

function isSinglePage() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setImage(element, page) {
  if (page?.image) {
    element.style.backgroundImage = `url("${page.image}")`;
    element.classList.add("has-image");
    return;
  }

  element.style.backgroundImage = "";
  element.classList.remove("has-image");
}

function updatePages() {
  const leftIndex = currentSpread * 2;
  const rightIndex = leftIndex + 1;

  setImage(leftMedia, pages[leftIndex]);
  setImage(rightMedia, pages[isSinglePage() ? leftIndex : rightIndex]);

  previousButton.disabled = currentSpread === 0;
  nextButton.disabled = currentSpread >= totalSpreads() - 1;
  progressBar.style.width = `${((currentSpread + 1) / totalSpreads()) * 100}%`;
}

function canTurn(direction) {
  const nextSpread = currentSpread + direction;
  return nextSpread >= 0 && nextSpread < totalSpreads();
}

function pageForTurn(direction) {
  const leftIndex = currentSpread * 2;
  const rightIndex = leftIndex + 1;

  if (isSinglePage()) {
    return pages[leftIndex];
  }

  return direction > 0 ? pages[rightIndex] : pages[leftIndex];
}

function pageWidthForTurn() {
  const rect = book.getBoundingClientRect();
  return isSinglePage() ? rect.width : (rect.width - 22) / 2;
}

function setTurnProgress(progress, direction) {
  const angle = direction > 0 ? -178 * progress : 178 * progress;
  const lift = 4 + progress * 18;

  turnSheet.style.setProperty("--turn-angle", `${angle}deg`);
  turnSheet.style.setProperty("--turn-lift", `${lift}px`);
}

function prepareTurn(direction) {
  isTurning = true;
  setImage(turnMedia, pageForTurn(direction));
  setTurnProgress(0, direction);

  turnSheet.className = "turn-sheet is-active";
  if (direction < 0) {
    turnSheet.classList.add("is-backward");
  }

  if (isSinglePage()) {
    turnSheet.classList.add("is-single");
  }
}

function clearTurn() {
  turnSheet.className = "turn-sheet";
  turnSheet.style.removeProperty("--turn-angle");
  turnSheet.style.removeProperty("--turn-lift");
  turnSheet.style.removeProperty("--turn-duration");
  setImage(turnMedia, null);
  isTurning = false;
}

function finishTurn(direction, shouldComplete) {
  turnSheet.style.setProperty("--turn-duration", shouldComplete ? `${turnDuration}ms` : `${cancelDuration}ms`);
  turnSheet.classList.add("is-settling");
  setTurnProgress(shouldComplete ? 1 : 0, direction);

  window.setTimeout(() => {
    if (shouldComplete) {
      currentSpread += direction;
      updatePages();
    }

    clearTurn();
  }, shouldComplete ? turnDuration : cancelDuration);
}

function animateTurn(direction) {
  if (isTurning || !canTurn(direction)) {
    return;
  }

  prepareTurn(direction);

  window.requestAnimationFrame(() => {
    turnSheet.classList.add("is-settling");
    setTurnProgress(1, direction);
    finishTurn(direction, true);
  });
}

function directionFromDrag(sourcePage, deltaX) {
  if (Math.abs(deltaX) < dragStartThreshold) {
    return 0;
  }

  if (isSinglePage()) {
    return deltaX < 0 ? 1 : -1;
  }

  if (sourcePage === rightPage && deltaX < 0) {
    return 1;
  }

  if (sourcePage === leftPage && deltaX > 0) {
    return -1;
  }

  return 0;
}

function startDrag(event) {
  if (isTurning) {
    return;
  }

  dragState = {
    direction: 0,
    pointerId: event.pointerId,
    progress: 0,
    sourcePage: event.currentTarget,
    startX: event.clientX,
    startY: event.clientY,
  };

  event.currentTarget.classList.add("is-grabbing");

  if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Older or synthetic pointer events may not support capture.
    }
  }
}

function moveDrag(event) {
  if (!dragState) {
    return;
  }

  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    event.preventDefault();
  }

  if (!dragState.direction) {
    const direction = directionFromDrag(dragState.sourcePage, deltaX);

    if (!direction || !canTurn(direction)) {
      return;
    }

    dragState.direction = direction;
    prepareTurn(direction);
  }

  const width = pageWidthForTurn();
  const rawProgress = dragState.direction > 0 ? -deltaX / width : deltaX / width;
  dragState.progress = clamp(rawProgress, 0, 1);
  setTurnProgress(dragState.progress, dragState.direction);
}

function endDrag() {
  if (!dragState) {
    return;
  }

  dragState.sourcePage.classList.remove("is-grabbing");

  if (!dragState.direction) {
    dragState = null;
    return;
  }

  const direction = dragState.direction;
  const shouldComplete = dragState.progress >= commitThreshold;
  dragState = null;
  finishTurn(direction, shouldComplete);
}

previousButton.addEventListener("click", () => animateTurn(-1));
nextButton.addEventListener("click", () => animateTurn(1));

closeWelcomeButton.addEventListener("click", () => {
  welcomeModal.classList.add("is-hidden");
});

welcomeModal.addEventListener("click", (event) => {
  if (event.target === welcomeModal) {
    welcomeModal.classList.add("is-hidden");
  }
});

[leftPage, rightPage].forEach((page) => {
  page.addEventListener("pointerdown", startDrag);
});

window.addEventListener("pointermove", moveDrag, { passive: false });
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    welcomeModal.classList.add("is-hidden");
  }

  if (event.key === "ArrowLeft") {
    animateTurn(-1);
  }

  if (event.key === "ArrowRight") {
    animateTurn(1);
  }
});

window.addEventListener("resize", updatePages);

updatePages();
