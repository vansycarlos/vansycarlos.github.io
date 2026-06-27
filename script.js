const pages = [
  { image: "assets/pages/1.png" },
  { image: "assets/pages/2.png" },
  { image: "assets/pages/3.png" },
  { image: "assets/pages/4.png" },
  { image: "assets/pages/5.png" },
  { image: "assets/pages/6.png" },
];

const book = document.querySelector("#book");
const previousButton = document.querySelector("#prevPage");
const nextButton = document.querySelector("#nextPage");
const progressBar = document.querySelector("#progressBar");
const leftMedia = document.querySelector("#leftMedia");
const rightMedia = document.querySelector("#rightMedia");
const turnMedia = document.querySelector("#turnMedia");
const welcomeModal = document.querySelector("#welcomeModal");
const closeWelcomeButton = document.querySelector("#closeWelcome");
const pageSwapDelay = 430;
const turnDuration = 980;

let currentSpread = 0;
let isTurning = false;
let dragStartX = 0;
let dragStartY = 0;
let dragDeltaX = 0;
let isDragging = false;

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
  const singlePage = window.matchMedia("(max-width: 760px)").matches;

  setImage(leftMedia, pages[leftIndex]);
  setImage(rightMedia, pages[singlePage ? leftIndex : rightIndex]);

  previousButton.disabled = currentSpread === 0;
  nextButton.disabled = currentSpread >= Math.ceil(pages.length / 2) - 1;
  progressBar.style.width = `${((currentSpread + 1) / Math.ceil(pages.length / 2)) * 100}%`;
}

function getVisiblePage(direction) {
  const leftIndex = currentSpread * 2;
  const rightIndex = leftIndex + 1;
  const singlePage = window.matchMedia("(max-width: 760px)").matches;

  if (singlePage) {
    return pages[leftIndex];
  }

  return direction > 0 ? pages[rightIndex] : pages[leftIndex];
}

function turnPage(direction) {
  if (isTurning) {
    return;
  }

  const nextSpread = currentSpread + direction;
  const lastSpread = Math.ceil(pages.length / 2) - 1;

  if (nextSpread < 0 || nextSpread > lastSpread) {
    return;
  }

  isTurning = true;
  setImage(turnMedia, getVisiblePage(direction));
  book.classList.add(
    "is-turning",
    "is-page-exiting",
    direction > 0 ? "is-turning-forward" : "is-turning-backward",
  );

  window.setTimeout(() => {
    currentSpread = nextSpread;
    updatePages();
    book.classList.remove("is-page-exiting");
    book.classList.add("is-page-entering");
  }, pageSwapDelay);

  window.setTimeout(() => {
    book.classList.remove(
      "is-turning",
      "is-turning-forward",
      "is-turning-backward",
      "is-page-exiting",
      "is-page-entering",
    );
    setImage(turnMedia, null);
    isTurning = false;
  }, turnDuration);
}

previousButton.addEventListener("click", () => turnPage(-1));
nextButton.addEventListener("click", () => turnPage(1));
closeWelcomeButton.addEventListener("click", () => {
  welcomeModal.classList.add("is-hidden");
});

welcomeModal.addEventListener("click", (event) => {
  if (event.target === welcomeModal) {
    welcomeModal.classList.add("is-hidden");
  }
});

book.addEventListener("pointerdown", (event) => {
  if (isTurning) {
    return;
  }

  isDragging = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragDeltaX = 0;
  book.classList.add("is-dragging");

  if (book.setPointerCapture && event.pointerId !== undefined) {
    try {
      book.setPointerCapture(event.pointerId);
    } catch {
      // Some synthetic or older pointer events cannot be captured.
    }
  }
});

book.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }

  const deltaY = event.clientY - dragStartY;
  dragDeltaX = event.clientX - dragStartX;

  if (Math.abs(dragDeltaX) > Math.abs(deltaY)) {
    event.preventDefault();
  }

  const tilt = Math.max(-8, Math.min(8, dragDeltaX / 28));
  book.style.transform = `rotateX(6deg) rotateY(${tilt}deg)`;
});

function finishDrag() {
  if (!isDragging) {
    return;
  }

  const swipeThreshold = 52;
  isDragging = false;
  book.classList.remove("is-dragging");
  book.style.transform = "";

  if (Math.abs(dragDeltaX) < swipeThreshold) {
    return;
  }

  turnPage(dragDeltaX < 0 ? 1 : -1);
}

book.addEventListener("pointerup", finishDrag);
book.addEventListener("pointercancel", finishDrag);
book.addEventListener("lostpointercapture", finishDrag);
window.addEventListener("pointerup", finishDrag);
window.addEventListener("pointercancel", finishDrag);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    welcomeModal.classList.add("is-hidden");
  }

  if (event.key === "ArrowLeft") {
    turnPage(-1);
  }

  if (event.key === "ArrowRight") {
    turnPage(1);
  }
});

window.addEventListener("resize", updatePages);

updatePages();
