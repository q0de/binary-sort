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
const summary = document.querySelector("#summary");
const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const bestStreakEl = document.querySelector("#bestStreak");
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

function startRound() {
  state.deck = shuffleConstrained(BASE_DECK);
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
  for (let index = 0; index < 5; index += 1) {
    const layer = document.createElement("div");
    layer.className = "stack-card";
    layer.style.setProperty("--i", index);
    stack.append(layer);
  }
}

function dealIn() {
  state.locked = true;
  const layers = [...stack.children];
  gsap.set(layers, { y: 220, opacity: 0, rotate: -12, scale: 0.92 });
  gsap.set(card, { x: 0, y: 180, opacity: 0, rotate: 9, scale: 0.96, "--drag-power": 0, "--drag-hotspot": "84%" });

  const timeline = gsap.timeline({
    defaults: { ease: "back.out(1.8)" },
    onComplete: () => showCard(),
  });

  timeline.to(layers, {
    y: (index) => index * -7,
    opacity: 1,
    rotate: (index) => (index - 2) * 2.2,
    scale: 1,
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

function showCard(options = {}) {
  const current = state.deck[state.index];
  if (!current) {
    showSummary();
    return;
  }

  activeTimeline?.kill();
  clearBucketState();
  outcome.textContent = "";
  outcome.className = "outcome";
  renderCardContent(current);
  state.locked = true;

  if (options.entrance) {
    animateNextCardEntrance();
    return;
  }

  gsap.set(card, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, "--drag-power": 0, "--drag-hotspot": "84%" });
  liftActiveCard();
}

function renderCardContent(current) {
  symbol.className = `symbol symbol-${current.symbolFamily}`;
  cardVariant.textContent = current.variant;
  card.dataset.family = current.symbolFamily;
  card.setAttribute("aria-label", `${current.symbolFamily} card. Drag left for circles or right for angles.`);
}

function liftActiveCard() {
  state.locked = false;

  activeTimeline = gsap.timeline();
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
  scheduleIdleNudge();
  scheduleShimmer();
}

function animateNextCardEntrance() {
  shimmerTween?.kill();
  idleTween?.kill();
  playGameSound("next", { frequency: 330, duration: 0.045, volume: 0.055 });

  const layers = [...stack.children];
  const entryRotate = Math.random() > 0.5 ? 4.5 : -4.5;
  gsap.set(card, {
    x: 0,
    y: 78,
    rotate: entryRotate,
    scale: 0.92,
    opacity: 0,
    "--drag-power": 0,
    "--drag-hotspot": "84%",
  });

  activeTimeline = gsap.timeline({
    defaults: { ease: "power2.out" },
    onComplete: () => {
      state.locked = false;
      scheduleIdleNudge();
      scheduleShimmer();
    },
  });

  activeTimeline
    .to(layers, {
      y: (index) => index * -7 - 7,
      rotate: (index) => (index - 2) * 2.2 + 0.8,
      duration: prefersReducedMotion ? 0.08 : 0.12,
      stagger: prefersReducedMotion ? 0 : 0.012,
      ease: "power2.in",
    })
    .to(layers, {
      y: (index) => index * -7,
      rotate: (index) => (index - 2) * 2.2,
      duration: prefersReducedMotion ? 0.12 : 0.2,
      stagger: prefersReducedMotion ? 0 : 0.016,
      ease: "back.out(2)",
    })
    .to(card, {
      y: -14,
      rotate: entryRotate * -0.24,
      scale: 1.035,
      opacity: 1,
      duration: prefersReducedMotion ? 0.16 : 0.34,
      ease: "back.out(2.4)",
    }, prefersReducedMotion ? "-=0.06" : "-=0.13")
    .to(card, {
      y: 0,
      rotate: 0,
      scale: 1,
      duration: prefersReducedMotion ? 0.1 : 0.18,
      ease: "power2.out",
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

function scheduleShimmer() {
  shimmerTween?.kill();
  const sheen = card.querySelector(".card-sheen");
  gsap.set(sheen, { xPercent: -125, opacity: 0 });

  shimmerTween = gsap.timeline({
    delay: prefersReducedMotion ? 4.5 : 1.1 + Math.random() * 1.2,
    repeat: -1,
    repeatDelay: prefersReducedMotion ? 6 : 2.1 + Math.random() * 1.6,
  });
  shimmerTween
    .to(sheen, {
      opacity: prefersReducedMotion ? 0.28 : 0.78,
      duration: prefersReducedMotion ? 0.08 : 0.05,
      ease: "power1.out",
    })
    .to(sheen, {
      xPercent: 125,
      duration: prefersReducedMotion ? 0.48 : 0.36,
      ease: "power2.inOut",
    }, "<")
    .to(sheen, {
      opacity: 0,
      duration: prefersReducedMotion ? 0.12 : 0.08,
      ease: "power1.out",
    }, "-=0.08")
    .set(sheen, { xPercent: -125 });
}

function onPointerDown(event) {
  if (state.locked || state.dragging) return;
  unlockAudio();
  idleTween?.kill();
  activeTimeline?.kill();
  shimmerTween?.pause();

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

  event.preventDefault();
  unlockAudio();
  idleTween?.kill();
  shimmerTween?.pause();
  const bucket = event.key === "ArrowLeft" ? "A" : "B";
  setBucketProgress(bucket, 1);
  gsap.to(card, {
    x: bucket === "A" ? -72 : 72,
    y: -18,
    rotate: bucket === "A" ? -8 : 8,
    scale: 1.04,
    duration: prefersReducedMotion ? 0.06 : 0.12,
    ease: "power2.out",
    onComplete: () => commitChoice(bucket),
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
    duration: prefersReducedMotion ? 0.14 : 0.28,
    ease: "back.out(1.8)",
    onComplete: () => scheduleIdleNudge(),
  });
}

function commitChoice(chosenBucket) {
  state.locked = true;
  idleTween?.kill();
  shimmerTween?.kill();
  clearBucketState();
  pulseCommitFlash(chosenBucket);
  playGameSound("commit", { frequency: 420, duration: 0.045, volume: 0.045 });

  const current = state.deck[state.index];
  const correct = chosenBucket === current.correctBucket;
  if (correct) {
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }
  updateStats();

  if (correct) {
    playGameSound("correct", { frequency: 660, duration: 0.08, volume: 0.08 });
    vibrate(25);
    showOutcome("✓", "correct");
    flyToBucket(chosenBucket, true);
  } else {
    playGameSound("wrong", { frequency: 180, duration: 0.12, volume: 0.075 });
    vibrate([35, 40, 25]);
    showOutcome("×", "wrong");
    wrongFallAway(chosenBucket, current.correctBucket);
  }
}

function showOutcome(mark, kind) {
  outcome.textContent = mark;
  outcome.className = `outcome is-visible is-${kind}`;
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
        y: kind === "correct" ? -78 : 82,
        scale: prefersReducedMotion ? 0.9 : 0.76,
        opacity: 0,
        duration: prefersReducedMotion ? 0.28 : 0.58,
        ease: "power2.out",
        delay: prefersReducedMotion ? 0.05 : 0.12,
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
  outcome.className = "outcome";
  outcome.textContent = "";

  if (state.index >= state.deck.length) {
    showSummary();
    return;
  }

  showCard({ entrance: true });
}

function showSummary() {
  state.locked = true;
  idleTween?.kill();
  shimmerTween?.kill();
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
    const manifestResponse = await fetch("/audio/sfx-manifest.json", { cache: "no-store" });
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
card.addEventListener("keydown", onKeyDown);
playAgain.addEventListener("click", startRound);

startRound();
