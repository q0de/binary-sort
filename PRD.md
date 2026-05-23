# PRD: Binary Sort Mobile Arcade Game

## Summary

Build a mobile-first, glossy holographic arcade card game where the player sorts each dealt card into one of two abstract buckets by dragging or swiping left or right. The first version should deliver one highly polished repeatable loop: cards deal into a rising pile, the active card lifts, the player chooses left or right, instant juicy feedback confirms correctness, and the next card becomes available immediately.

This PRD is intended for Codex implementation with Claude used as a reviewer and critic. Claude should review game feel, UX clarity, and PRD/build quality, but should not own priority decisions.

## Target Runtime

- V1 ships as a mobile-first web game running in the browser.
- Primary target viewport is portrait mobile, with touch interaction as the main input.
- Desktop browser support is allowed for development and review, using mouse drag as an equivalent input, but desktop layout polish is secondary to mobile.
- Minimum supported mobile browsers: iOS Safari 16+ and Chrome Android 110+.
- Desktop review minimum: layout must not break, mouse drag must work, and the game must remain playable; no desktop-specific visual polish is required for V1.
- The game should start directly in the playable interaction with no landing page.

## Animation Technology

- Use GSAP 3.13+ as the primary animation choreography library for V1.
- Render V1 with DOM elements and CSS transforms, not a canvas; GSAP should animate DOM element transforms, opacity, filters/glows, and CSS variables.
- Use GSAP timelines for deal-in, stack rise, active-card lift, idle nudge, commit, correct feedback, incorrect feedback, next-card entrance, and round summary transitions.
- Use native Pointer Events as the default input layer for active-card drag tracking, release velocity calculation, and commit detection.
- Pointer Events implementation must handle `pointercancel`, use `setPointerCapture` on pointerdown, set `touch-action: none` on the active card, apply a 6-8px drag dead-zone before the card follows the pointer, and smooth release velocity over the last 3 pointer-move samples.
- Use GSAP to render drag-responsive transforms, glow intensity, release choreography, and all non-drag timeline animation.
- GSAP Draggable may be used only if implementation testing shows it improves touch/mouse reliability without reducing control over the game gesture.
- Do not use automatic inertia throws to decide card destination. Commit decisions must remain controlled by the explicit distance/velocity thresholds in this PRD.
- GSAP InertiaPlugin is optional for cosmetic throw/settle polish after a decision is already made; it is not required for V1.
- Do not introduce a second general-purpose animation library in V1.
- Keep game state independent from animation timelines: score, streak, correctness, and deck progression should update from game events, not from animation completion alone.
- Reduced-motion mode should swap to shorter, lower-distance GSAP timelines rather than maintaining a separate animation system.

## Product Experience

- The player sees a futuristic glossy card stack dominating the center and lower screen, with the prompt at the top so the swipe area stays open and graphic-forward.
- Each card belongs to Bucket A or Bucket B according to a fixed V1 prototype rule: cards with circle symbols sort left into Bucket A, and cards with angle symbols sort right into Bucket B.
- The top card is interactive. It subtly lifts and nudges left and right after 2.5 seconds of inactivity to teach the gesture.
- Dragging left or right creates strong directional feedback: glow, tilt, parallax, screen-edge energy, and bucket highlighting.
- Releasing past a threshold commits the choice.
- Correctness feedback is instant and juicy: checkmark or X, punchy glow, small shake/pop, particle/spark burst, score/streak pulse, then rapid transition to the next card.
- Cards should feel casino-like and dopamine-tuned: short anticipation, tactile drag, decisive lock-in, immediate reward/repair signal, fast retry cadence.
- Bucket targets should feel integrated into the background energy: Bucket A anchors bottom-left, Bucket B anchors top-right, with large directional glow zones rather than standalone UI boxes.

## Content Model

- V1 uses a fixed 12-card round.
- Each card has an `id`, `symbolFamily`, `correctBucket`, and visual face variant.
- `symbolFamily: circle` maps to `correctBucket: A`, shown as the left bucket.
- `symbolFamily: angle` maps to `correctBucket: B`, shown as the right bucket.
- The top prompt reads: "Sort the signal: circles left, angles right."
- Bucket labels are "A / Circles" on the left and "B / Angles" on the right.
- The prototype deck should contain 6 circle cards and 6 angle cards in a constrained shuffled order.
- Shuffle constraint: no more than 2 cards from the same bucket may appear in a row.

## Core Loop

1. A small stack of cards is dealt onto the screen with staggered timing.
2. The stack rises as new cards arrive; the final active card lands slightly misaligned, then straightens.
3. The active card lifts into focus.
4. The top prompt displays the sorting challenge while left/right bucket labels remain visible near the swipe zones.
5. The player drags or swipes the card left or right.
6. The chosen side glows and intensifies as the drag nears the commit threshold.
7. On release, the card snaps or flies toward the chosen side.
8. A check or X appears immediately.
9. If correct, the card flies into the chosen bucket and the streak increments.
10. If incorrect, the card flashes X, continues toward the chosen side, then falls away off-screen from that side while the correct side is indicated separately by glow/text state.
11. The next card slides or lifts into the active position with minimal delay.
12. After the 12th card, show a compact round summary with score, best streak, and a "Play Again" action that resets score/streak and reshuffles the same 12-card deck using the shuffle constraint.

## Interaction And Timing Targets

- Commit threshold: horizontal drag of at least 35% of the card width, or release velocity of at least 0.8 px/ms in a left/right direction after moving at least 18% of card width or 45px, whichever is larger.
- While dragging, visual response should track the pointer immediately; target input-to-visual feedback is under 50ms.
- Correct/incorrect icon appears within 120ms after release.
- Next card becomes interactive within 450ms after a correct release and within 1100ms after an incorrect release.
- Idle nudge begins after 2.5 seconds with no drag/tap on the active card.
- Idle nudge repeats every 4 seconds until the player interacts, then pauses for the rest of the current card.
- Target animation performance is 60fps on a modern mobile browser; the experience should remain playable at 30fps without broken layout or missed input.

## Score And Round Rules

- Score is in scope for V1.
- Correct choice: +1 score and +1 streak.
- Track `score`, `streak`, and `bestStreak` for each round.
- On correct choice, increment `score` and `streak`, then update `bestStreak` if `streak` is higher than the current `bestStreak`.
- Incorrect choice: score does not increase and streak resets to 0.
- The round summary shows final score out of 12 and best streak.
- Incorrect cards are not re-queued in V1; each card is resolved once.
- Play Again resets score and streak, reshuffles the same 12-card deck, and starts a new round.
- The score and streak indicator should live in the top HUD beside or below the prompt, using compact text so it does not reduce the card's dominant screen space.

## Audio, Haptics, And Accessibility

- V1 includes lightweight optional web audio for card deal, next-card reveal, commit, correct, incorrect, and fall-away feedback.
- ElevenLabs Text to Sound Effects is the preferred production SFX source for V1 card sounds.
- Generate SFX as local MP3 assets and play them through the Web Audio API; do not call ElevenLabs from the browser at runtime.
- If ElevenLabs assets are missing or disabled, use lightweight Web Audio synth fallback sounds so the game remains playable.
- V1 uses the browser Vibration API for short haptic-like pulses where supported; unsupported browsers should silently skip vibration.
- Audio should unlock on the first user interaction, following browser autoplay rules; no tap-to-start gate is added for V1.
- It is acceptable if the first card interaction has no sound before audio unlocks.
- No user-visible mute toggle is required in V1.
- Correct and incorrect feedback must not rely on color alone; the check/X icon, motion, and text/state change must communicate the outcome.
- Honor `prefers-reduced-motion` by reducing idle nudges, particle bursts, large card flight distance, and repeated shake effects while preserving functional feedback.
- Reduced-motion correctness feedback must still include the check/X icon, a clear state/text change, and a short non-shaking glow.
- Touch targets and bucket zones should remain usable on narrow mobile screens without requiring precise taps.

## Visual And Motion Direction

- Style: semi-contemporary futuristic casino arcade; glossy holographic cards, premium shine, readable card identity.
- Use raster/bitmap-style imagery for key game art, not SVG-first card illustrations. Placeholder generated bitmap assets are acceptable for V1 as long as they establish the glossy holographic direction.
- Cards should look like physical cards: bevels, sheen, soft reflections, depth, and a clear face/back distinction.
- Motion should be plush and satisfying: springy easing, squash/stretch where appropriate, layered glow, and responsive drag physics.
- Avoid realism-heavy casino visuals; the tone should feel modern, playful, and polished rather than literal gambling.

## Asset Production Plan

- Treat generated visual direction images as reference-only unless an asset is generated specifically for in-game use.
- Do not slice the visual direction board into final sprites; its lighting, perspective, shadows, and glow are composition-specific and will not animate cleanly.
- Produce game-ready raster assets as separate reusable layers with transparent or removable flat backgrounds.
- V1 asset kit should include: card back, card face base, circle symbol variants, angle symbol variants, card shine overlay, left bucket glow, right bucket glow, check burst, X burst, particle/spark texture, and background/table surface.
- Keep card identity modular: the card base, symbol, shine, and feedback effects should be independently layered in the game.
- Card aspect ratio should be 2.5:3.5, matching standard playing-card proportions.
- Active card layout target: width should be about 72vw on narrow mobile, capped at 320px; asset source should be at least 2x the rendered cap, with a 640px-wide card base minimum.
- Handle drag, tilt, lift, squash, glow intensity, answer reveal, and card flight through runtime animation rather than baking motion into the sprite images.
- Placeholder generated assets are acceptable for implementation if they match the glossy holographic direction and are separated into reusable layers.
- Final production assets should use consistent lighting direction, card proportions, symbol scale, and color intensity so swapping symbols does not make the card feel like a different object.

## MVP Scope

- Include one playable mobile-first 12-card round loop using circle-vs-angle Bucket A/B content.
- Include card deal animation, active-card drag, idle nudge, left/right bucket glow, commit animation, correctness reveal, and next-card reset.
- Use GSAP as the choreography engine for V1 animation juice, with native Pointer Events as the default drag input layer.
- Render the game as DOM/CSS layers rather than canvas for V1.
- Include a basic score and streak indicator.
- Do not include full curriculum, account systems, leaderboards, shop, monetization, level map, complex progression, i18n, analytics/telemetry, or network-loaded deck content in V1.
- V1 copy is English-only.
- The 12-card prototype deck is hardcoded in source.

## Collaboration Model

- `Collab.md` is the active cross-agent review surface for Claude notes and critique.
- Keep product priorities separate from `Collab.md` in the "Priority Backlog" section of this PRD.
- Claude's role: reviewer for UX, animation feel, clarity, copy, and overall polish.
- Codex's role: implementation owner and source-of-truth maintainer for priorities and build execution.
- Any Claude suggestion must be converted into an explicit priority/backlog item before implementation.

## Priority Backlog

1. Lock the playable V1 loop: mobile web runtime, 12-card round, circle-left/angle-right sorting rule, score, streak, and round summary.
2. Add GSAP 3.13+ as the V1 animation dependency and centralize animation helpers/timelines.
3. Build native Pointer Events drag handling for the active card, including pointer capture/cancel handling, touch-action suppression, drag dead-zone, distance threshold, and smoothed velocity threshold calculation.
4. Build the tactile card interaction: deal-in stack, active-card lift, drag tracking, side glow, commit threshold, and idle nudge.
5. Add correctness feedback: instant check/X, correct fly-out, incorrect chosen-side fall-away, correct-side indication, and next-card timing.
6. Establish the visual direction with generated glossy holographic card assets and simple side-zone effects.
7. Produce the V1 asset kit as modular raster layers rather than slicing the visual direction board into sprites.
8. Run Claude review through `Collab.md`; convert accepted critique into new numbered backlog items here before implementation.

## Acceptance Criteria

- On a mobile viewport, the game starts directly in the playable card interaction, not a landing page.
- The top prompt is readable without reducing the card's dominance or interfering with swipe gestures.
- The V1 prompt and deck use the explicit rule: circle symbols sort left to Bucket A, angle symbols sort right to Bucket B.
- The deck shuffle never deals more than 2 cards from the same bucket in a row.
- The game renders as DOM/CSS layers, not canvas, for V1.
- GSAP powers the main animation choreography; native Pointer Events own drag input and commit detection; no second general-purpose animation library is added in V1.
- The card stack visibly deals in and rises with polished staggered animation.
- The active card clearly communicates it can be dragged left or right, including idle nudging.
- Dragging left or right produces obvious side-specific glow and selection feedback.
- Releasing left or right commits a bucket choice and immediately shows check/X correctness feedback.
- Correct answers increment score and streak; incorrect answers reset streak without re-queuing the card.
- Best streak is tracked separately and appears in the round summary.
- The next card becomes interactive within the defined timing targets.
- After 12 cards, a round summary appears with score, best streak, and Play Again; Play Again resets score/streak and reshuffles the same deck.
- Audio and vibration enhance feedback where supported, and the game remains fully usable without either.
- Reduced-motion users receive lower-intensity animations without losing outcome clarity.
- Bucket targets are integrated directional glow zones: A at bottom-left and B at top-right; incorrect cards continue toward the chosen side before falling away instead of flying to the correct bucket.
- The interface remains readable and uncluttered on small mobile screens.
- The experience feels arcade-like, glossy, and tactile rather than static quiz-like.

## Assumptions And Defaults

- First content mode uses circle-vs-angle Bucket A/B sorting rather than real curriculum.
- V1 is a browser-based mobile web game with touch-first controls and desktop mouse-drag support for development.
- Prompt location defaults to the top of the screen to preserve space for the card and swipe interaction.
- Feedback style defaults to instant and juicy, not suspense-based.
- MVP optimizes for one polished loop over broad game systems.
- Claude is a reviewer, not the priority owner.
