# Collab.md

Notes from Claude (Opus 4.7) to Codex as PRD.md is drafted.

Focus of my feedback: **scope and clarity pushback** — flagging vague requirements, ambiguous success criteria, and undefined scope boundaries. I'm not rewriting or proposing technical solutions; I'm asking the questions a reviewer would ask before signing off.

Format per pass:
- **Timestamp** — when I read PRD.md
- **What I read** — one-line summary of current state
- **Pushback** — numbered list of scope/clarity concerns
- **Open questions for the author** — things I'd want answered before the next pass

---

## 2026-05-23 12:07 — Pass 1

**What I read:** First full draft of the PRD. Strong on tone/feel and the moment-to-moment loop; thin on what defines "done" objectively and on the content model underneath the loop.

**Pushback (scope & clarity):**

1. **"Binary Sort" has no source of truth for correctness.** The PRD describes the *reaction* to correctness (check/X, glow, particles) but never defines what *makes* a card belong to Bucket A vs B in the MVP. "Placeholder abstract Bucket A/B content" is a hand-wave — placeholder *how*? Color? Shape? Number parity? Without this, Codex can't build the data model, scoring, or even the card face. Pick one trivial rule for v1 (e.g. "card shows a shape; circles→A, squares→B") and name it.

2. **"Mobile-first" is asserted but not bounded.** Native iOS? React Native? Mobile web in a browser? Touch-only or also mouse? This single decision changes the entire stack and most of the "juicy feedback" implementation. The PRD must name the target runtime.

3. **"Polished" / "juicy" / "plush" / "dopamine-tuned" are not acceptance criteria.** These words appear ~10× but none are testable. At minimum, pin numbers to the things that matter: max input-to-feedback latency (e.g. <50ms), commit-threshold distance, target frame rate, time from release → next card interactive (e.g. <400ms). Otherwise reviewers will disagree forever about whether v1 is done.

4. **Score/streak is simultaneously in and out of scope.** §MVP Scope says "include … only if it supports feedback without delaying the loop." That's a decision the implementer shouldn't have to make. Decide now: in or out. If in, define what increments it and what resets it.

5. **Card deck size and session length are undefined.** How many cards in a round? Does the round end? What happens after the last card — loop, summary, nothing? Without this, "the next card can be reached quickly" (acceptance criterion) has no terminal case.

6. **Incorrect-answer behavior is missing.** PRD only says "check or X appears." Does the card go to the wrong bucket and stay there? Bounce back? Get re-queued? Affect score? This is core loop behavior, not polish.

7. **"Raster/bitmap-style imagery, not SVG-first" is a constraint without an asset plan.** Who produces these assets for v1? Are placeholders acceptable? If yes, say so explicitly or Codex will block on art.

8. **Idle-nudge trigger is unspecified.** "After inactivity" — how many seconds? Does it repeat? Stop after first interaction in the session, or every card?

9. **§Collaboration Model contradicts the file you're already writing to.** PRD says "Create a future `collab.md`" (lowercase, future tense) — but `Collab.md` already exists and is in use. Reconcile the casing and drop "future."

10. **"Any Claude suggestion must be converted into an explicit priority/backlog item before implementation."** Where does that backlog live? This rule is unenforceable without naming the artifact (file path, tool, section of PRD).

**Open questions for the author:**

- What is the v1 sorting rule (the actual content of Bucket A vs Bucket B)?
- What runtime are we shipping to (iOS native / web / RN / Unity / other)?
- Round structure: fixed N cards, endless, timed?
- Wrong-answer behavior: punishing, forgiving, or invisible?
- Where does the "priority/backlog" live, and who writes the first entry?

---

## 2026-05-23 12:11 — Pass 2

**What I read:** Strong revision. Every one of my Pass 1 points is addressed: sorting rule (circles/angular), runtime (mobile web), measurable timing targets, score rules, round structure (12 cards + summary + Play Again), wrong-answer flow, placeholder-asset permission, idle-nudge cadence, Collab.md casing, and a Priority Backlog section. This is now buildable. Next-layer pushback below.

**Pushback (scope & clarity):**

1. **Vocabulary drift: "angular" vs "angles."** §Content Model uses `symbolFamily: angular` and label "B / Angles," but the top prompt reads "circles left, angles right." Three words for one concept (angular / angles / B). Pick one player-facing term and one code term and use them consistently — otherwise UI strings and data will diverge as the build grows.

2. **Velocity threshold for swipe is unnumbered.** §Interaction defines the *distance* threshold (35% card width) but only says "fast swipe with enough velocity." Without a number (e.g. >0.8 px/ms at release), Codex will pick one and you'll relitigate it during review. Same for the snap-back spring (stiffness/damping) — but velocity is the one that affects whether the input *feels* responsive.

3. **Incorrect-answer animation budget is overstuffed for 750ms.** The incorrect flow is: X flash → bump against chosen side → snap back to center → reveal correct-side glow → exit toward correct bucket → next card interactive. Six beats in 750ms is ~125ms each — that's too fast to read "the correct answer was the *other* side," which is the whole pedagogical point. Either extend the budget to ~1200ms for incorrect, or cut a beat (likely the snap-back-to-center).

4. **Audio and haptics are unmentioned.** "Juicy / dopamine-tuned" without sound or vibration is half the experience on mobile. Decide in/out for V1. If out, say so explicitly so Codex doesn't quietly add stub hooks that then get half-built.

5. **Accessibility is absent.** Check/X + glow is color-coded feedback; that's a problem for red-green colorblind players. Also no mention of `prefers-reduced-motion`, which matters because the whole feel is motion-forward. At minimum: state whether V1 honors reduced-motion or punts it.

6. **Shuffle isn't constrained.** A pure shuffle of 6 circle + 6 angular cards will sometimes deal 4–5 of the same type in a row, which makes the "sort" feel broken (player thinks they're stuck on one bucket). Either spec an interleave constraint (e.g. "no more than 2 in a row") or explicitly accept the streaks.

7. **"Play Again" is undefined.** New shuffle of the same 12 cards, or identical deck order? Score reset, or cumulative across rounds? One sentence.

8. **Score/streak display is unplaced.** §Product Experience says prompt is top, cards center/bottom. Score has to go *somewhere* and it can't compete with the card. Name the zone.

9. **"Modern mobile browser" is undefined.** Specify a floor (e.g. iOS Safari 16+, Chrome Android 110+). This affects which CSS/Web APIs Codex can rely on for the glossy effects.

10. **Desktop "secondary polish" has no minimum bar.** Reviewers will open the URL on a laptop. If desktop is allowed to look broken, that erodes confidence in the build during review. Define the minimum: "no layout breakage, mouse drag works, no commitment to desktop-specific polish."

**Open questions for the author:**

- Audio + haptics: in or out for V1?
- Reduced-motion: honored or deferred?
- Shuffle: constrained interleave, or accept clustering?
- "Play Again": reshuffle? score carry-over?
- Browser floor: which versions?

---

## 2026-05-23 12:14 — Pass 3

**What I read:** All 10 Pass 2 items resolved cleanly. Vocabulary normalized to circle/angle (with the snap-back beat dropped from the incorrect flow — good call, since it was the one cuttable beat). New "Asset Production Plan" section is a useful addition I didn't ask for. PRD is now tight enough that I'm reaching for smaller issues.

**Pushback (scope & clarity):**

1. **"Best streak" isn't backed by a tracked field.** §Score & Round Rules defines `score` and `streak`, and says "streak resets to 0" on incorrect. But §Acceptance and §Core Loop both reference "**best streak**" in the round summary. That requires a separate `bestStreak` field that updates whenever `streak > bestStreak`. Either add it to §Score & Round Rules or change the summary to show just final streak.

2. **Bucket destinations aren't visually defined.** Cards "fly into the chosen bucket" and buckets "highlight," but the PRD never says whether buckets are *labeled zones* (just text near edges) or *visible targets* (tray, slot, container). "Flies into" implies a destination shape. Pick: label-only edges, or actual visible bucket containers.

3. **Incorrect-flow travel arc is unspecified.** Player releases card toward *wrong* side. The flow is now: X flash → bump → reveal correct-side glow → card exits toward *correct* (opposite) bucket. That's a screen-wide reversal in roughly 1100ms minus the X/bump time. Does the card visibly arc across to the other side, or cut/fade and reappear? This is a noticeable beat and Codex will guess.

4. **Audio autoplay + no-landing-page contradiction.** "Audio should start muted or require the first user interaction" — but there's no landing page, so the first interaction *is* the first card sort. That means audio is guaranteed silent for card #1. Either accept that (state it), or add a one-tap "Tap to start" gate (which contradicts "starts directly in the playable interaction").

5. **`prefers-reduced-motion` reduces "particle bursts" — but those are core to "juicy."** Worth naming the irreducible minimum: e.g., "even with reduced motion, correctness feedback must include the check/X icon + a color/state change + a short, non-shaking glow." Otherwise the reduced-motion path could degrade to a static quiz, which the PRD explicitly says it must not feel like.

6. **Card aspect ratio / dimensions aren't specified.** §Asset Production Plan lists what to make but not the card's proportions or pixel target. This matters because the swipe physics (35% width threshold) depend on knowing what the card width *is* in a layout.

7. **Audio "optional" is ambiguous.** Is there a user-visible mute toggle in V1, or does "optional" just mean "may not play due to autoplay rules"? If a toggle exists, it needs a screen location; if it doesn't, say so.

8. **Closing-the-door items worth one line each:** no i18n in V1 (prompt is English-only), no analytics/telemetry in V1, card deck is hardcoded in source (not loaded from network). Each of these is an obvious "out" but stating them prevents Codex from adding scaffolding.

**Open questions for the author:**

- Buckets: label-only edges, or visible container shapes?
- Audio on card #1: silently miss it, or add a tap-to-start?
- Reduced-motion irreducible minimum: what must always be shown?

**Note on cadence:** The PRD is in good shape. From here, further passes will mostly be nits unless the implementation surfaces new questions. Consider switching me from "review every revision" to "review on demand" once Codex starts building.

---

## 2026-05-23 12:17 — Pass 4 (sign-off)

**What I read:** All 8 Pass 3 items resolved. `bestStreak` tracked, buckets are visible tray/slot targets, incorrect cards visibly arc to the correct bucket, audio/no-landing contradiction reconciled (first-card sound loss accepted, no mute toggle), reduced-motion minimum spelled out, card aspect 2.5:3.5 with 72vw/320px/640px source dimensions, and "closing the door" items added (no i18n, no telemetry, hardcoded deck).

**Verdict:** This PRD is buildable. From here I'd start implementation rather than another review pass. Codex has unambiguous answers to: what to build, for what runtime, against what timing budgets, with what asset proportions, and what is explicitly out.

**Two truly minor nits (not blockers):**

1. Bucket-tray layout vs card placement isn't pinned. Trays are "near the lower side edges"; card is "center and lower screen." On narrow viewports these could collide. Not worth solving on paper — solve it when you can see it.
2. The 1100ms incorrect budget still has to fit: X (instant) + bump + correct-side reveal + arc across screen. On a fast device the arc may flash by. Worth a play-test note, not a PRD edit.

**Suggested handoff:** Switch me to on-demand review. Ping me (or have Codex ping me) when there's a build to react to, when a new scope question comes up, or when copy/UX choices need a second pair of eyes. Polling every 90s for PRD edits stops being valuable now.

---

## 2026-05-23 — Pass 5 (animation library)

**Trigger:** Author flagged that the PRD never names an animation library and is recommending **GSAP**.

**Confirmation of the gap:** Correct — PRD §Visual & Motion and §Asset Production specify motion *qualities* (springy easing, squash/stretch, layered glow, "handle motion through runtime animation rather than baking") but never name the tool. Codex will silently pick one. Worth deciding on paper.

**My take on GSAP for this build: strong default, endorse with caveats.**

Why it fits Binary Sort specifically:
- The core loop is a *choreographed sequence of beats* (deal-in stack → lift → drag → glow ramp → commit → X/bump → correct-side reveal → arc to correct bucket → next-card slide). GSAP's Timeline model maps to this directly; chaining + offsets + labels are exactly the primitive you want.
- GSAP Draggable handles the touch/mouse drag, velocity tracking (which the PRD's 0.8 px/ms threshold needs), inertia, and snap-back in a battle-tested way. Rolling this from Pointer Events is doable but eats days.
- Performance on mobile Safari/Chrome (the PRD's targets) is good — uses transforms, batches reads/writes, won't fight the compositor.
- The whole library and all plugins (Draggable, InertiaPlugin, MorphSVG, etc.) went fully free in 2024 under Webflow. No license blocker.
- Honoring `prefers-reduced-motion` is trivial: a single `gsap.globalTimeline.timeScale()` or per-tween guard.

Caveats worth noting in the PRD:
- **Springs aren't first-class.** GSAP's easing is keyframe-curve-based; "plush, squishy" physics-spring feel (the kind react-spring / Framer Motion / Motion One give you free) needs CustomEase or InertiaPlugin tuning. For this PRD's "plush and satisfying / squash and stretch," GSAP gets there but the implementer should know it's tuned by hand, not by stiffness/damping numbers.
- **Bundle size.** GSAP core ~23KB gzipped + Draggable ~6KB + InertiaPlugin ~5KB. Not heavy, but worth knowing for a mobile-web target.
- **Imperative API.** Fine here because there's no React-style declarative framework in play. If Codex picks React/Solid/Svelte later, the wrapper story is OK but not ideal.

Alternatives I'd consider rejected for this PRD (but worth naming so Codex doesn't relitigate):
- **Framer Motion** — best-in-class if React is chosen; not chosen here.
- **Motion One** — lightweight WAAPI wrapper, springs free, but timeline/sequencing story is weaker for a 6-beat correctness flow.
- **Anime.js** — lighter, but no equivalent to Draggable + Inertia and less robust on mobile edge cases.
- **Native WAAPI + Pointer Events** — zero-dep, but the implementer rebuilds Draggable/Inertia/Timeline from scratch. Not worth it for V1.

**Recommendation:** Adopt GSAP as the V1 animation/drag library. Specifically:
- GSAP core
- GSAP Draggable (for the active-card drag + velocity threshold)
- InertiaPlugin (for flick/release physics, snap-back, and the incorrect-arc trajectory)

**What to add to the PRD (suggested edits to §Visual & Motion Direction, or a new §Tech Stack):**
- Animation runtime: **GSAP 3** with **Draggable** and **InertiaPlugin**.
- Drag-velocity tracking comes from Draggable; the 0.8 px/ms commit threshold reads from Draggable's tracker.
- Spring/squash feel achieved via CustomEase + scale tweens, not a physics-spring library.
- Reduced-motion path uses GSAP's globalTimeline timeScale + per-tween skips for shake/particle bursts.

**Open question for the author:** Any preference between DOM (HTML elements + CSS transforms, GSAP animating them) vs Canvas (single canvas, GSAP animating object props)? For 12 cards + a few HUD elements, DOM is simpler, has free accessibility, and GSAP handles it well. Canvas is overkill unless you want hundreds of particles. Recommend DOM unless Codex has a reason.

---

## 2026-05-23 — Pass 6 (animation tech review)

**What I read:** New §Animation Technology section. Codex adopted GSAP 3.13+ but **declined** Draggable as the default drag layer (native Pointer Events instead, Draggable allowed only if testing shows it helps) and **declined** InertiaPlugin for commit decisions (cosmetic-only post-decision). Also added a strong principle: "Keep game state independent from animation timelines."

**My take: Codex's deviation is defensible and arguably better than my recommendation. Endorsing with caveats.**

Why their call holds up:
- The commit decision (35% width OR 0.8 px/ms) is the *game-defining moment*. Making it explicit rather than delegating to Draggable's internal logic means no surprises where physics throws a card past threshold the user pulled back from. This is the right instinct.
- "Game state independent from animation timelines" is a load-bearing principle for testability and for the reduced-motion path. Worth keeping.
- Native Pointer Events on modern mobile browsers (the PRD's targets — iOS 16+, Chrome Android 110+) are stable and well-supported; the velocity-tracking code is ~10 lines.
- Smaller dependency surface; no Draggable plugin needed for V1.

**What Codex now owns by writing this from scratch (worth a one-line risk note in the PRD):**
- iOS Safari touch quirks: `touch-action: none` on the active card to prevent scroll/zoom hijack mid-drag.
- `pointercancel` handling (incoming call, system gesture) — release the card cleanly to its origin, don't leave it stuck mid-drag.
- Velocity smoothing: a single-frame delta is noisy. Track the last ~3 pointer moves and average, or velocity will spike at release and misfire the 0.8 px/ms threshold.
- Drag start threshold: a small dead-zone (e.g. 6–8px) before the card starts following the pointer, so a tap doesn't read as a 1px drag.
- Pointer capture: `setPointerCapture` on pointerdown so the gesture survives the finger leaving the card's bounds.

These are exactly the cases Draggable solves out of the box. If implementation hits any of them and the workaround grows, that's the trigger to revisit and adopt Draggable — the PRD already leaves that door open.

**Concur on InertiaPlugin call:** Cosmetic-only is the right scope. Letting inertia *decide* would conflict with the explicit threshold and is the failure mode worth avoiding.

**Still open from Pass 5 — DOM vs Canvas — wasn't addressed.** The §Animation Technology section implicitly assumes DOM (GSAP + Pointer Events on DOM is the standard pairing), but it isn't stated. Worth one line: "Render via DOM elements with CSS transforms; not a canvas." Otherwise Codex could pick canvas later and the Pointer Events plan changes.

**Verdict:** §Animation Technology is good. Add the DOM-not-canvas line and a brief "Pointer Events implementation must handle: pointercancel, pointer capture, velocity smoothing, drag dead-zone, touch-action" risk note (or accept those as implementation-detail nits and move on). Otherwise the PRD is genuinely ready to build against.






