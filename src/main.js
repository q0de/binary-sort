import gsap from "gsap";
import "./styles.css";

const BASE_DECK = [
  { id: "c-01", symbolFamily: "circle", correctBucket: "A", variant: "S-01" },
  { id: "c-02", symbolFamily: "circle", correctBucket: "A", variant: "S-02" },
  { id: "c-03", symbolFamily: "circle", correctBucket: "A", variant: "S-03" },
  { id: "c-04", symbolFamily: "circle", correctBucket: "A", variant: "S-04" },
  { id: "c-05", symbolFamily: "circle", correctBucket: "A", variant: "S-05" },
  { id: "c-06", symbolFamily: "circle", correctBucket: "A", variant: "S-06" },
  { id: "a-01", symbolFamily: "angle", correctBucket: "B", variant: "A-01" },
  { id: "a-02", symbolFamily: "angle", correctBucket: "B", variant: "A-02" },
  { id: "a-03", symbolFamily: "angle", correctBucket: "B", variant: "A-03" },
  { id: "a-04", symbolFamily: "angle", correctBucket: "B", variant: "A-04" },
  { id: "a-05", symbolFamily: "angle", correctBucket: "B", variant: "A-05" },
  { id: "a-06", symbolFamily: "angle", correctBucket: "B", variant: "A-06" },
];

const CARD_STYLE_DEFAULT = "aurora-foil";
const CARD_STYLE_DEFAULT_VERSION = "aurora-foil-png-v1";
const SPECIAL_CARD_COUNT = 1;
const GLEAM_CARD_CHANCE = 0.38;
const ASSET_BASE_URL = import.meta.env.BASE_URL;
const MAX_VISIBLE_STACK_CARDS = BASE_DECK.length;
const STACK_BASE_Y = 72;
const STACK_DRAW_Y = 50;
const STACK_DEPTH_Y = 3.5;
const STACK_SCALE_STEP = 0.012;

const state = {
  deck: [],
  index: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  locked: true,
  dragging: false,
  audioUnlocked: false,
  drag: {
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    active: false,
    samples: [],
  },
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const card = document.querySelector("#card");
const stack = document.querySelector("#stack");
const symbol = document.querySelector("#cardSymbol");
const cardVariant = document.querySelector("#cardVariant");
const outcome = document.querySelector("#outcome");
const outcomeSprite = document.querySelector("#outcomeSprite");
const summary = document.querySelector("#summary");
const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const bestStreakEl = document.querySelector("#bestStreak");
const cardStyleSelect = document.querySelector("#cardStyle");
const summaryScore = document.querySelector("#summaryScore");
const summaryBest = document.querySelector("#summaryBest");
const playAgain = document.querySelector("#playAgain");
const commitFlash = document.querySelector("#commitFlash");
const buckets = {
  A: document.querySelector('[data-bucket="A"]'),
  B: document.querySelector('[data-bucket="B"]'),
};

let idleTween;
let activeTimeline;
let shimmerTween;
let audioContext;
let audioLoadPromise;
let audioAssetsEnabled = false;
const audioBuffers = new Map();

function applyCardStyle(style) {
  const selectedStyle = style || CARD_STYLE_DEFAULT;
  document.querySelector("#app").dataset.cardStyle = selectedStyle;
  localStorage.setItem("binary-sort-card-style", selectedStyle);
}

function shuffleConstrained(cards) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    if (!hasLongRun(shuffled)) return shuffled;
  }

  const circles = cards.filter((cardData) => cardData.correctBucket === "A");
  const angles = cards.filter((cardData) => cardData.correctBucket === "B");
  return circles.flatMap((circle, index) => [circle, angles[index]]);
}

function hasLongRun(cards) {
  let run = 1;
  for (let index = 1; index < cards.length; index += 1) {
    if (cards[index].correctBucket === cards[index - 1].correctBucket) {
      run += 1;
      if (run > 2) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

function buildRoundDeck() {
  const deck = shuffleConstrained(BASE_DECK).map((cardData) => ({
    ...cardData,
    special: false,
    gleam: Math.random() < GLEAM_CARD_CHANCE,
  }));
  const eligibleIndexes = deck.map((_, index) => index);

  for (let count = 0; count < SPECIAL_CARD_COUNT && eligibleIndexes.length > 0; count += 1) {
    const drawIndex = Math.floor(Math.random() * eligibleIndexes.length);
    const [specialIndex] = eligibleIndexes.splice(drawIndex, 1);
    deck[specialIndex] = {
      ...deck[specialIndex],
      gleam: true,
      special: true,
      variant: `${deck[specialIndex].variant}*`,
    };
  }

  return deck;
}

function currentCardHasGleam() {
  return Boolean(state.deck[state.index]?.gleam);
}

function assetPath(path) {
  return `${ASSET_BASE_URL}${path}`;
}

function startRound() {
  state.deck = buildRoundDeck();
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  summary.setAttribute("aria-hidden", "true");
  summary.classList.remove("is-visible");
  updateStats();
  buildStack();
  dealIn();
}

function buildStack() {
  stack.innerHTML = "";
  for (let index = 0; index < MAX_VISIBLE_STACK_CARDS; index += 1) {
    const layer = document.createElement("div");
    layer.className = "stack-card";
    layer.dataset.stackIndex = String(index);
    layer.style.setProperty("--i", index);
    stack.append(layer);
  }
}

function updateStackVisual(animated = true) {
  const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
  const layers = [...stack.children];
  layers.forEach((layer, index) => {
    const visible = index < remainingAfterActive;
    const depth = remainingAfterActive - index - 1;
    const vars = {
      opacity: visible ? 1 : 0,
      y: visible ? depth * STACK_DEPTH_Y + STACK_BASE_Y : STACK_BASE_Y + 28,
      rotate: visible ? (depth - Math.min(remainingAfterActive, 7) / 2) * 1.4 : 0,
      scale: visible ? 0.94 - Math.min(depth, 9) * STACK_SCALE_STEP : 0.88,
    };

    if (animated) {
      gsap.to(layer, { ...vars, duration: prefersReducedMotion ? 0.12 : 0.24, ease: "power2.out" });
    } else {
      gsap.set(layer, vars);
    }
  });
}

function dealIn() {
  state.locked = true;
  stopShimmer();
  const current = state.deck[state.index];
  const layers = [...stack.children];
  renderCardContent(current);
  gsap.set(layers, { y: 220, opacity: 0, rotate: -12, scale: 0.92 });
  card.classList.add("is-flipping-from-back");
  gsap.set(card, { x: 0, y: 180, opacity: 0, rotate: 9, rotateY: 0, scale: 0.96, transformPerspective: 900, "--drag-power": 0, "--drag-hotspot": "84%", "--drag-cyan": 0.5, "--drag-pink": 0.5 });

  const timeline = gsap.timeline({
    defaults: { ease: "back.out(1.8)" },
    onComplete: () => animateInitialCardReveal(),
  });

  timeline.to(layers, {
    y: (index) => (MAX_VISIBLE_STACK_CARDS - index - 2) * STACK_DEPTH_Y + STACK_BASE_Y,
    opacity: 1,
    rotate: (index) => (MAX_VISIBLE_STACK_CARDS - index - 5) * 1.2,
    scale: (index) => 0.94 - Math.min(MAX_VISIBLE_STACK_CARDS - index - 2, 9) * STACK_SCALE_STEP,
    duration: prefersReducedMotion ? 0.18 : 0.48,
    stagger: prefersReducedMotion ? 0.02 : 0.08,
  });
  timeline.to(card, {
    y: 0,
    opacity: 1,
    rotate: 0,
    scale: 1,
    duration: prefersReducedMotion ? 0.18 : 0.55,
  }, "-=0.12");
}

function animateInitialCardReveal() {
  stopShimmer();
  updateStackVisual(false);

  activeTimeline = gsap.timeline({
    defaults: { ease: "power2.out" },
    onComplete: () => {
      card.classList.remove("is-flipping-from-back");
      liftActiveCard({ gleam: false });
    },
  });

  activeTimeline
    .to(card, {
      y: -24,
      scale: 1.04,
      duration: prefersReducedMotion ? 0.12 : 0.2,
      ease: "back.out(2.2)",
    })
    .call(() => {
      if (currentCardHasGleam()) playLiftGleam();
    })
    .to(card, {
      rotateY: 90,
      scale: 1.035,
      duration: prefersReducedMotion ? 0.08 : 0.14,
      ease: "power2.in",
      onComplete: () => {
        card.classList.remove("is-flipping-from-back");
        gsap.set(card, { rotateY: -90 });
        if (currentCardHasGleam()) playFlipGleam();
      },
    })
    .to(card, {
      rotateY: 0,
      scale: 1.035,
      duration: prefersReducedMotion ? 0.1 : 0.17,
      ease: "power2.out",
    })
    .to(card, {
      y: 0,
      rotate: 0,
      rotateY: 0,
      scale: 1,
      duration: prefersReducedMotion ? 0.1 : 0.18,
      ease: "back.out(2)",
    });
}

function showCard(options = {}) {
  const current = state.deck[state.index];
  if (!current) {
    showSummary();
    return;
  }

  activeTimeline?.kill();
  clearBucketState();
  if (!options.preserveOutcome) {
    resetOutcome();
  }
  renderCardContent(current);
  state.locked = true;

  if (options.entrance) {
    card.classList.add("is-flipping-from-back");
    animateNextCardEntrance();
    return;
  }

  updateStackVisual(false);
  card.classList.remove("is-flipping-from-back");
  gsap.set(card, { x: 0, y: 0, rotate: 0, rotateY: 0, scale: 1, opacity: 1, transformPerspective: 900, "--drag-power": 0, "--drag-hotspot": "84%", "--drag-cyan": 0.5, "--drag-pink": 0.5 });
  liftActiveCard();
}

function renderCardContent(current) {
  symbol.className = `symbol symbol-${current.symbolFamily}`;
  cardVariant.textContent = current.variant;
  card.dataset.family = current.symbolFamily;
  card.classList.toggle("is-special", Boolean(current.special));
  card.setAttribute("aria-label", `${current.special ? "Special " : ""}${current.symbolFamily} card. Drag left for circles or right for angles.`);
}

function liftActiveCard({ gleam = true } = {}) {
  state.locked = false;
  stopShimmer();

  activeTimeline = gsap.timeline({
    onComplete: () => {
      scheduleIdleNudge();
      if (gleam && currentCardHasGleam()) playLiftGleam();
    },
  });
  activeTimeline.fromTo(card, {
    y: 22,
    rotate: -2,
    scale: 0.98,
  }, {
    y: -8,
    rotate: 0,
    scale: 1.02,
    duration: prefersReducedMotion ? 0.16 : 0.36,
    ease: "back.out(2)",
  }).to(card, {
    y: 0,
    scale: 1,
    duration: prefersReducedMotion ? 0.12 : 0.22,
    ease: "power2.out",
  });
}

function animateNextCardEntrance() {
  stopShimmer();
  idleTween?.kill();
  playGameSound("next", { frequency: 330, duration: 0.045, volume: 0.055 });

  const layers = [...stack.children];
  const entryRotate = Math.random() > 0.5 ? 4.5 : -4.5;
  gsap.set(card, {
    x: 0,
    y: STACK_BASE_Y,
    rotate: entryRotate * 0.35,
    rotateY: 0,
    scale: 0.94,
    opacity: 1,
    transformPerspective: 900,
    "--drag-power": 0,
    "--drag-hotspot": "84%",
    "--drag-cyan": 0.5,
    "--drag-pink": 0.5,
  });

  activeTimeline = gsap.timeline({
    defaults: { ease: "power2.out" },
    onComplete: () => {
      card.classList.remove("is-flipping-from-back");
      state.locked = false;
      scheduleIdleNudge();
    },
  });

  activeTimeline
    .to(layers, {
      y: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        const depth = remainingAfterActive - index - 1;
        return index < remainingAfterActive ? depth * STACK_DEPTH_Y + STACK_DRAW_Y : STACK_BASE_Y + 28;
      },
      rotate: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        const depth = remainingAfterActive - index - 1;
        return index < remainingAfterActive ? (depth - Math.min(remainingAfterActive, 7) / 2) * 1.4 + 0.8 : 0;
      },
      opacity: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        return index < remainingAfterActive ? 1 : 0;
      },
      scale: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        const depth = remainingAfterActive - index - 1;
        return index < remainingAfterActive ? 0.94 - Math.min(depth, 9) * STACK_SCALE_STEP : 0.88;
      },
      duration: prefersReducedMotion ? 0.08 : 0.12,
      stagger: prefersReducedMotion ? 0 : 0.012,
      ease: "power2.in",
    })
    .to(layers, {
      y: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        const depth = remainingAfterActive - index - 1;
        return index < remainingAfterActive ? depth * STACK_DEPTH_Y + STACK_BASE_Y : STACK_BASE_Y + 28;
      },
      rotate: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        const depth = remainingAfterActive - index - 1;
        return index < remainingAfterActive ? (depth - Math.min(remainingAfterActive, 7) / 2) * 1.4 : 0;
      },
      opacity: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        return index < remainingAfterActive ? 1 : 0;
      },
      scale: (index) => {
        const remainingAfterActive = Math.max(state.deck.length - state.index - 1, 0);
        const depth = remainingAfterActive - index - 1;
        return index < remainingAfterActive ? 0.94 - Math.min(depth, 9) * STACK_SCALE_STEP : 0.88;
      },
      duration: prefersReducedMotion ? 0.12 : 0.2,
      stagger: prefersReducedMotion ? 0 : 0.016,
      ease: "back.out(2)",
    })
    .to(card, {
      y: -34,
      rotate: entryRotate * -0.24,
      scale: 1.045,
      duration: prefersReducedMotion ? 0.14 : 0.22,
      ease: "back.out(2.4)",
    }, prefersReducedMotion ? "-=0.06" : "-=0.13")
    .to(card, {
      y: -38,
      rotate: entryRotate * -0.18,
      scale: 1.055,
      duration: prefersReducedMotion ? 0.04 : 0.1,
      ease: "sine.inOut",
    })
    .call(() => {
      if (currentCardHasGleam()) playLiftGleam();
    })
    .to(card, {
      rotateY: 90,
      scale: 1.04,
      duration: prefersReducedMotion ? 0.08 : 0.16,
      ease: "power2.in",
      onComplete: () => {
        card.classList.remove("is-flipping-from-back");
        gsap.set(card, { rotateY: -90 });
        if (currentCardHasGleam()) playFlipGleam();
      },
    })
    .to(card, {
      rotateY: 0,
      scale: 1.04,
      duration: prefersReducedMotion ? 0.1 : 0.18,
      ease: "power2.out",
    })
    .to(card, {
      y: 0,
      rotate: 0,
      rotateY: 0,
      scale: 1,
      duration: prefersReducedMotion ? 0.12 : 0.22,
      ease: "back.out(2)",
    });
}

function scheduleIdleNudge() {
  idleTween?.kill();
  if (prefersReducedMotion || state.locked) return;
  idleTween = gsap.timeline({ delay: 2.5, repeat: -1, repeatDelay: 4 });
  idleTween.to(card, { y: -12, rotate: -3, x: -16, duration: 0.22, ease: "sine.inOut" })
    .to(card, { x: 16, rotate: 3, duration: 0.36, ease: "sine.inOut" })
    .to(card, { x: 0, y: 0, rotate: 0, duration: 0.26, ease: "back.out(1.8)" });
}

function playLiftGleam() {
  shimmerTween?.kill();
  const sheen = card.querySelector(".card-sheen");
  gsap.set(sheen, { xPercent: -60, opacity: 0 });

  shimmerTween = gsap.timeline();
  shimmerTween
    .to(sheen, {
      opacity: prefersReducedMotion ? 0.26 : 0.72,
      duration: prefersReducedMotion ? 0.08 : 0.05,
      ease: "power1.out",
    })
    .to(sheen, {
      xPercent: 60,
      duration: prefersReducedMotion ? 0.54 : 0.48,
      ease: "power2.inOut",
    }, "<")
    .to(sheen, {
      opacity: 0,
      duration: prefersReducedMotion ? 0.12 : 0.08,
      ease: "power1.out",
    }, "-=0.08")
    .set(sheen, { xPercent: -60 })
    .call(() => {
      shimmerTween = null;
    });
}

function playFlipGleam() {
  const sheen = card.querySelector(".card-sheen");
  if (!sheen) return;

  gsap.killTweensOf(sheen);
  gsap.fromTo(sheen, {
    xPercent: -64,
    opacity: 0,
  }, {
    xPercent: 64,
    opacity: prefersReducedMotion ? 0.34 : 0.9,
    duration: prefersReducedMotion ? 0.3 : 0.44,
    ease: "power2.out",
    onComplete: () => {
      gsap.to(sheen, {
        opacity: 0,
        duration: prefersReducedMotion ? 0.08 : 0.14,
        ease: "power1.out",
        onComplete: () => gsap.set(sheen, { xPercent: -60 }),
      });
    },
  });
}

function stopShimmer() {
  shimmerTween?.kill();
  shimmerTween = null;
  const sheen = card.querySelector(".card-sheen");
  if (sheen) gsap.set(sheen, { xPercent: -60, opacity: 0 });
}

function onPointerDown(event) {
  if (state.locked || state.dragging) return;
  unlockAudio();
  idleTween?.kill();
  activeTimeline?.kill();
  stopShimmer();

  state.dragging = true;
  state.drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: 0,
    y: 0,
    active: false,
    samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }],
  };
  card.setPointerCapture(event.pointerId);
  card.classList.add("is-dragging");
  gsap.to(card, {
    y: -24,
    scale: 1.045,
    "--drag-power": 0.18,
    "--drag-cyan": 0.5,
    "--drag-pink": 0.5,
    duration: prefersReducedMotion ? 0.08 : 0.18,
    ease: "back.out(2.5)",
  });
}

function onPointerMove(event) {
  if (!state.dragging || event.pointerId !== state.drag.pointerId) return;

  const x = event.clientX - state.drag.startX;
  const y = event.clientY - state.drag.startY;
  const distance = Math.hypot(x, y);
  if (!state.drag.active && distance < 7) return;

  state.drag.active = true;
  state.drag.x = x;
  state.drag.y = y;
  state.drag.samples.push({ x: event.clientX, y: event.clientY, time: performance.now() });
  state.drag.samples = state.drag.samples.slice(-3);
  renderDrag(x, y);
}

function renderDrag(x, y) {
  const cardWidth = card.getBoundingClientRect().width;
  const progress = Math.min(Math.abs(x) / (cardWidth * 0.55), 1);
  const bucket = x < 0 ? "A" : "B";
  const direction = x < 0 ? -1 : 1;
  const clampedY = Math.max(-80, Math.min(80, y * 0.35));

  gsap.set(card, {
    x,
    y: clampedY - progress * 22,
    rotate: direction * (progress * 13),
    scale: 1 + progress * 0.035,
    "--drag-power": progress,
    "--drag-hotspot": direction < 0 ? "16%" : "84%",
    "--drag-cyan": direction < 0 ? 1 : 0,
    "--drag-pink": direction > 0 ? 1 : 0,
  });
  setBucketProgress(bucket, progress);
}

function onPointerUp(event) {
  if (!state.dragging || event.pointerId !== state.drag.pointerId) return;
  finishDrag(event, false);
}

function onPointerCancel(event) {
  if (!state.dragging || event.pointerId !== state.drag.pointerId) return;
  finishDrag(event, true);
}

function onKeyDown(event) {
  if (state.locked || state.dragging) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (event.target?.matches?.("input, textarea, select, button")) return;

  event.preventDefault();
  unlockAudio();
  state.locked = true;
  idleTween?.kill();
  activeTimeline?.kill();
  stopShimmer();
  const bucket = event.key === "ArrowLeft" ? "A" : "B";
  const direction = bucket === "A" ? -1 : 1;
  const shoveDistance = Math.min(window.innerWidth * 0.22, card.getBoundingClientRect().width * 0.46);

  card.classList.add("is-dragging");
  renderDrag(direction * shoveDistance, -18);
  gsap.timeline()
    .to(card, {
      x: direction * Math.min(window.innerWidth * 0.34, card.getBoundingClientRect().width * 0.72),
      y: -30,
      rotate: direction * 11,
      scale: 1.055,
      "--drag-power": 1,
      "--drag-hotspot": direction < 0 ? "16%" : "84%",
      "--drag-cyan": direction < 0 ? 1 : 0,
      "--drag-pink": direction > 0 ? 1 : 0,
      duration: prefersReducedMotion ? 0.08 : 0.16,
      ease: "back.out(2.2)",
    })
    .call(() => {
      card.classList.remove("is-dragging");
      commitChoice(bucket);
    });
}

function finishDrag(event, canceled) {
  state.dragging = false;
  card.classList.remove("is-dragging");
  if (card.hasPointerCapture?.(event.pointerId)) {
    card.releasePointerCapture(event.pointerId);
  }

  if (canceled || !state.drag.active) {
    resetCard();
    return;
  }

  const cardWidth = card.getBoundingClientRect().width;
  const velocity = getVelocity();
  const x = state.drag.x;
  const velocityDistance = Math.abs(x) >= Math.max(45, cardWidth * 0.18);
  const velocityCommit = velocityDistance && Math.abs(velocity.x) >= 0.8 && Math.abs(velocity.x) > Math.abs(velocity.y);
  const distanceCommit = Math.abs(x) >= cardWidth * 0.35;

  if (!velocityCommit && !distanceCommit) {
    resetCard();
    return;
  }

  const chosenBucket = velocityCommit ? (velocity.x < 0 ? "A" : "B") : (x < 0 ? "A" : "B");
  commitChoice(chosenBucket);
}

function getVelocity() {
  const samples = state.drag.samples;
  if (samples.length < 2) return { x: 0, y: 0 };
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsed = Math.max(last.time - first.time, 1);
  return {
    x: (last.x - first.x) / elapsed,
    y: (last.y - first.y) / elapsed,
  };
}

function resetCard() {
  clearBucketState();
  gsap.to(card, {
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    "--drag-power": 0,
    "--drag-cyan": 0.5,
    "--drag-pink": 0.5,
    duration: prefersReducedMotion ? 0.14 : 0.28,
    ease: "back.out(1.8)",
    onComplete: () => scheduleIdleNudge(),
  });
}

function commitChoice(chosenBucket) {
  state.locked = true;
  idleTween?.kill();
  stopShimmer();
  clearBucketState();
  pulseCommitFlash(chosenBucket);
  playGameSound("commit", { frequency: 420, duration: 0.045, volume: 0.045 });

  const current = state.deck[state.index];
  const correct = chosenBucket === current.correctBucket;
  if (correct) {
    state.score += 1;
    if (current.special) {
      playGameSound("correct", { frequency: 880, duration: 0.09, volume: 0.09 });
      vibrate([18, 24, 18]);
    }
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }
  updateStats();

  if (correct) {
    playGameSound("correct", { frequency: 660, duration: 0.08, volume: 0.08 });
    vibrate(25);
    showOutcome("correct");
    flyToBucket(chosenBucket, true);
  } else {
    playGameSound("wrong", { frequency: 180, duration: 0.12, volume: 0.075 });
    vibrate([35, 40, 25]);
    showOutcome("wrong");
    wrongFallAway(chosenBucket, current.correctBucket);
  }
}

function showOutcome(kind) {
  const outcomeClass = `outcome is-visible is-${kind}`;
  outcome.setAttribute("aria-label", kind === "correct" ? "Correct" : "Wrong");
  outcomeSprite.src = kind === "correct"
    ? assetPath("images/outcomes/outcome-check-fit.webp")
    : assetPath("images/outcomes/outcome-x-fit.webp");
  outcomeSprite.alt = kind === "correct" ? "Correct" : "Wrong";
  outcome.className = outcomeClass;
  gsap.killTweensOf(outcome);
  gsap.fromTo(outcome, {
    y: 0,
    rotate: kind === "correct" ? -8 : 8,
    scale: 0.28,
    opacity: 0,
  }, {
    y: kind === "correct" ? -18 : 14,
    rotate: 0,
    scale: prefersReducedMotion ? 1 : 1.24,
    opacity: 1,
    duration: prefersReducedMotion ? 0.1 : 0.16,
    ease: "back.out(4)",
    onComplete: () => {
      gsap.to(outcome, {
        y: kind === "correct" ? -132 : 118,
        scale: prefersReducedMotion ? 0.9 : 0.7,
        opacity: 0,
        duration: prefersReducedMotion ? 0.32 : 0.82,
        ease: "sine.out",
        delay: prefersReducedMotion ? 0.06 : 0.18,
        onComplete: () => {
          if (outcome.className === outcomeClass) {
            resetOutcome();
          }
        },
      });
    },
  });
}

function flyToBucket(bucket, correct) {
  const direction = bucket === "A" ? -1 : 1;
  const timeline = gsap.timeline({ onComplete: nextCard });
  buckets[bucket].classList.add(correct ? "is-correct" : "is-active");
  timeline.to(card, {
    x: direction * (window.innerWidth * 0.58),
    y: prefersReducedMotion ? 18 : 78,
    rotate: direction * 24,
    scale: 0.72,
    opacity: 0,
    "--drag-power": 1,
    duration: prefersReducedMotion ? 0.18 : 0.34,
    ease: "power3.in",
  });
}

function wrongFallAway(chosenBucket, correctBucket) {
  const chosenDirection = chosenBucket === "A" ? -1 : 1;
  buckets[chosenBucket].classList.add("is-wrong");
  playGameSound("fallAway", { frequency: 120, duration: 0.08, volume: 0.045 });

  const timeline = gsap.timeline({ onComplete: nextCard });
  timeline.to(card, {
    x: chosenDirection * 104,
    rotate: chosenDirection * 12,
    duration: prefersReducedMotion ? 0.12 : 0.18,
    ease: "power2.out",
  }).to(card, {
    x: chosenDirection * 72,
    rotate: chosenDirection * 4,
    duration: prefersReducedMotion ? 0.08 : 0.14,
    ease: "back.out(2)",
    onComplete: () => {
      buckets[correctBucket].classList.add("is-correct");
    },
  }).to(card, {
    x: chosenDirection * (window.innerWidth * 0.62),
    y: prefersReducedMotion ? 42 : window.innerHeight * 0.42,
    rotate: chosenDirection * 34,
    scale: 0.68,
    opacity: 0,
    "--drag-power": 0.7,
    duration: prefersReducedMotion ? 0.24 : 0.5,
    ease: "power3.in",
  }, prefersReducedMotion ? "+=0.02" : "+=0.1");
}

function pulseCommitFlash(bucket) {
  const directionClass = bucket === "A" ? "from-left" : "from-right";
  commitFlash.className = `commit-flash ${directionClass}`;
  gsap.killTweensOf(commitFlash);
  gsap.fromTo(commitFlash, {
    opacity: 0,
    scale: 0.82,
  }, {
    opacity: prefersReducedMotion ? 0.28 : 0.78,
    scale: 1.08,
    duration: prefersReducedMotion ? 0.08 : 0.13,
    ease: "power2.out",
    onComplete: () => {
      gsap.to(commitFlash, {
        opacity: 0,
        scale: 1.22,
        duration: prefersReducedMotion ? 0.14 : 0.34,
        ease: "power3.out",
      });
    },
  });
}

function nextCard() {
  state.index += 1;
  clearBucketState();
  card.classList.remove("is-special");

  if (state.index >= state.deck.length) {
    updateStackVisual(true);
    showSummary();
    return;
  }

  showCard({ entrance: true, preserveOutcome: true });
}

function resetOutcome() {
  outcome.className = "outcome";
  outcome.removeAttribute("aria-label");
  outcomeSprite.removeAttribute("src");
  outcomeSprite.alt = "";
}

function showSummary() {
  state.locked = true;
  idleTween?.kill();
  stopShimmer();
  summaryScore.textContent = `${state.score} / ${state.deck.length}`;
  summaryBest.textContent = `Best streak ${state.bestStreak}`;
  summary.setAttribute("aria-hidden", "false");
  summary.classList.add("is-visible");
  gsap.fromTo(".summary-panel", {
    y: 40,
    scale: 0.96,
    opacity: 0,
  }, {
    y: 0,
    scale: 1,
    opacity: 1,
    duration: prefersReducedMotion ? 0.18 : 0.38,
    ease: "back.out(1.8)",
  });
}

function setBucketProgress(bucket, progress) {
  clearBucketState();
  buckets[bucket].classList.add("is-active");
  buckets[bucket].style.setProperty("--power", progress.toFixed(2));
}

function clearBucketState() {
  Object.values(buckets).forEach((bucketEl) => {
    bucketEl.classList.remove("is-active", "is-correct", "is-wrong");
    bucketEl.style.setProperty("--power", "0");
  });
}

function updateStats() {
  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  bestStreakEl.textContent = state.bestStreak;
}

async function unlockAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  state.audioUnlocked = true;
  audioLoadPromise ??= loadAudioAssets();
}

async function loadAudioAssets() {
  if (!audioContext) return;
  try {
    const manifestResponse = await fetch(assetPath("audio/sfx-manifest.json"), { cache: "no-store" });
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.json();
    if (!manifest.enabled || !manifest.files) return;

    const entries = Object.entries(manifest.files);
    await Promise.all(entries.map(async ([key, path]) => {
      const response = await fetch(path);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.set(key, audioBuffer);
    }));
    audioAssetsEnabled = audioBuffers.size > 0;
  } catch {
    audioAssetsEnabled = false;
  }
}

function playGameSound(key, fallback) {
  if (!state.audioUnlocked || !audioContext) return;
  const buffer = audioBuffers.get(key);
  if (buffer) {
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    gain.gain.value = fallback.volume ?? 0.75;
    source.connect(gain).connect(audioContext.destination);
    source.start();
    return;
  }
  playTone(fallback.frequency, fallback.duration, fallback.volume);
}

function playTone(frequency, duration, volume = 0.08) {
  if (!state.audioUnlocked || !audioContext || audioAssetsEnabled) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "triangle";
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.02);
}

function vibrate(pattern) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

card.addEventListener("pointerdown", onPointerDown);
card.addEventListener("pointermove", onPointerMove);
card.addEventListener("pointerup", onPointerUp);
card.addEventListener("pointercancel", onPointerCancel);
window.addEventListener("keydown", onKeyDown);
playAgain.addEventListener("click", startRound);
cardStyleSelect.addEventListener("change", (event) => applyCardStyle(event.target.value));

const savedDefaultVersion = localStorage.getItem("binary-sort-card-style-default-version");
const savedCardStyle = savedDefaultVersion === CARD_STYLE_DEFAULT_VERSION
  ? localStorage.getItem("binary-sort-card-style") || CARD_STYLE_DEFAULT
  : CARD_STYLE_DEFAULT;
localStorage.setItem("binary-sort-card-style-default-version", CARD_STYLE_DEFAULT_VERSION);
cardStyleSelect.value = savedCardStyle;
applyCardStyle(savedCardStyle);
startRound();
