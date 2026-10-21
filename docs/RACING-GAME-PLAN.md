# Vula's Car Wash Racing Game — Product and Gameplay Plan

**Status:** Approved direction for implementation planning; not a claim that these mechanics are already implemented or QA-passed.  
**Repository:** `gatshaayanda/vulas-car-wash`  
**Planning principle:** Build and QA the landing-page warm-up as the driving-mechanics foundation before layering in the championship.

## 1. Product goal

Create a compact, satisfying, F1-inspired arcade racing game inside Vula's Car Wash PWA. Customers should be able to practise for a few minutes while waiting for their vehicle, with meaningful driving skill, an inviting visual presentation, and a reason to return through personal records and later championship progression.

The game must remain an optional customer-engagement feature. It must not interfere with wash bookings, service requests, customer accounts, admin workflows, offline behaviour, or the approved PWA installation experience.

## 2. Implementation sequence: warm-up first

### Phase 1 — landing-page Warm-up (the QA gate)

Build one polished, self-contained practice experience accessible directly from the landing page. Do not begin by building out all divisions, tracks, qualifying sessions, rewards, or advanced race systems.

The warm-up uses **one carefully art-directed top-division car model** as the player's practice car. This is the only car model whose warm-up lap records/high scores are recorded. The car should feel like the aspirational flagship of the game: clearly readable from the gameplay camera, recognisable at small mobile sizes, and supported by polished acceleration, braking, steering, boost, and upgrade animations.

The warm-up must include:

- A complete, repeatable track with straights, varied corners, braking zones, apexes, corner exits, kerbs/track boundaries, and a start/finish line.
- Touch-first mobile controls and keyboard support where practical: accelerate, brake/reverse as appropriate, steer, boost, pause/resume, and restart.
- A clear speed readout and useful feedback for braking, grip, cornering, and boost.
- A driving model with acceleration, momentum, braking distance, steering response that depends on speed, grip loss, and recoverable slides. A fast car should not be able to take every corner at full throttle without consequence.
- A racing-line learning loop: approach/braking point → turn-in → apex → exit. If a suggested line is displayed, it should teach these phases without forcing the player to follow it.
- A polished boost system with an unmistakable visual and motion response (for example, rear glow/trails, a brief speed effect, and a boost meter). Boost should change the car's actual performance, not be cosmetic only.
- A compact garage/setup panel showing upgrades and the actual effect of each selected upgrade on visible stats and driving behaviour.
- A high-score experience based on recorded warm-up performance, especially best lap time. Show current lap, best lap, and improvement/sector feedback where supported.
- Clear loading, pause, resume, restart, first-run instructions, and error/offline states. Do not claim a record was saved if persistence failed.

**The warm-up is the gameplay test bench.** The product owner will QA it before any broader game layers are added. Driving feel, touch control reliability, readable visuals, track boundaries, lap timing, boost, upgrade effects, and truthful high-score persistence must be solid first.

### High-score fairness

Keep the warm-up leaderboard tied to the one flagship car model. Do not introduce alternative car models into warm-up records. Because upgrades change performance, save the active upgrade/loadout with each result and make the setup visible when comparing records. Prefer a clearly explained comparison policy (such as separate bests by setup or a leaderboard that records the setup alongside each time) over silently comparing materially different configurations as if they were identical.

Records must be tied to the app's real persistence capabilities. If the player is offline or a save fails, preserve the local result where feasible, clearly label it as local/pending, and never claim it is shared or synced until verified. Avoid excessive Firestore reads/writes; save meaningful lap results rather than every frame or control input.

## 3. Driving model and corner craft

The goal is approachable arcade handling with skill depth—not a professional simulator.

### Core driving mechanics

1. **Acceleration and momentum:** speed builds over time and does not change instantly.
2. **Braking zones:** braking before turn-in preserves control; late braking can gain time but risks running wide.
3. **Turn-in:** steering response changes with speed. Sharp steering at high speed should be harder to sustain.
4. **Apex:** the player aims for the inside point of a corner.
5. **Corner exit:** unwind steering and accelerate progressively to build speed onto the next straight.
6. **Grip:** braking, turning, and acceleration compete for tyre grip. Overloading grip can create understeer or oversteer.
7. **Track limits and kerbs:** legal kerb use can help a racing line; corner cutting or leaving the track should cost time or trigger a fair warning/penalty.
8. **Boost:** strategically timed acceleration with real handling/performance consequences and clear visual feedback.
9. **Slipstream (later phase):** following a rival on a straight can create a modest tow, making a pull-out and overtake possible.
10. **Race starts, tyre wear/temperature, sector strategy, and deeper race rules** are later additions, only after the warm-up foundation is accepted.

### Teaching and feedback

Keep feedback short and actionable, for example: “Brake earlier,” “Apex missed,” “Good exit,” or “Clean lap.” Use lap/sector times or a best-lap ghost when reliable. Avoid cluttering the screen during a corner; post-corner or post-lap feedback is preferable.

## 4. Upgrades and visual response

Upgrades should be understandable and measurable. Each upgrade must affect the underlying driving model and have an obvious, appropriately designed response in both the garage and gameplay.

Potential upgrade categories:

- **Power / acceleration:** improves acceleration and the rate at which speed builds.
- **Brakes:** improves deceleration and/or makes braking control more forgiving.
- **Grip / tyres:** improves cornering traction and recovery from slides.
- **Boost system:** changes boost capacity, duration, recharge, or efficiency, with matching meter/animation changes.

Requirements:

- Show before/after stats and concise plain-language effects.
- Reflect the equipped setup in the car's appearance where practical and in the car's actual physics.
- Animate boost clearly while active, then transition smoothly back to normal driving.
- Do not let upgrades eliminate the need to brake or choose a racing line.
- Record the setup with high-score results so performance differences are transparent.
- Keep currency, upgrade purchases, and remote persistence out of the critical driving loop; handle save failures honestly.

## 5. AI rivals — later championship phase

The two named rivals should have recognisable default personalities, but should not behave like predictable scripts. On each meaningful AI decision, use a 50/50 choice between the rival's signature behaviour and the contrasting behaviour. Across four listed situation types, this produces an expected two signature choices and two contrasting choices—not a guaranteed exact two per race.

**Important implementation detail:** roll the behaviour at a decision point (such as the approach to a corner or an overtaking opportunity), then hold that choice for the decision window. Do not randomly flip the choice every frame; that would look broken rather than human. Use a seeded/replayable random source in tests where possible so QA can reproduce cases.

| Situation | Kago — The Attacker (default personality) | Neo — The Smooth One (default personality) |
|---|---|---|
| Approaching a corner | Brakes late | Brakes earlier |
| Overtaking | Looks for aggressive openings | Waits for safer opportunities |
| Corner exit | May lose speed after pushing too hard | Usually exits consistently |
| Defending | Tries to hold position | Favours a clean racing line |
| Player's advantage | Exploit his mistakes | Beat his consistency with better pace |

For each decision, the AI has a 50% chance to use the behaviour in its column and a 50% chance to use the contrasting behaviour. Example: Kago may occasionally brake early or wait for a safer pass; Neo may occasionally brake late or attempt an aggressive opening. Keep their overall driving feel recognisable through other stable traits (such as risk tolerance, consistency, and recovery), even when a particular action is atypical.

AI must account for nearby cars and avoid deliberately turning through the player's car. Mistakes should emerge from understandable decisions and driving limits, not arbitrary speed cheating. Tune difficulty by driving skill/consistency rather than making rivals unfairly fast.

## 6. Track and progression roadmap

After the warm-up is QA-approved, layer the game in this order:

1. **Competitive race loop:** player versus Kago and Neo, starting positions, position/order, lap counting, finish/results, restart and pause.
2. **Three initial circuit identities:**
   - **Gaborone Dust Loop:** approachable track for learning braking, basic corners, and limits.
   - **Tlokweng Sprint:** straights and linked corners that reward momentum and boost timing.
   - **Makgadikgadi Bend:** technical layout with a hairpin, multiple braking zones, and demanding exits.
3. **Race weekend:** practice/warm-up, qualifying, then division races.
4. **Championship:** four divisions × three tracks, for 12 tracks total.
5. **Rewards and progression:** planned race rewards are P2,000 for first and P1,000 for second; qualifying rewards are P1,000 / P500 / P250 for first / second / third. Verify the existing economy before implementing or changing amounts.
6. **Later depth:** slipstreaming, sector times, best-lap ghost, track challenges, tyre wear/temperature, race starts and expanded AI behaviours.
7. **Optional social layer:** leaderboards and race feed only with real, access-controlled persistence and clear online/offline status.

Do not build all these layers before the warm-up is stable and approved.

## 7. Persistence, privacy, and app integration

- Keep racing data isolated from wash bookings, service requests, receipts, and appointment records.
- Inspect existing Firebase configuration and Firestore rules before adding or changing collections.
- Use owner-scoped profiles/results where applicable and least-privilege rules for any shared leaderboard.
- Never make a database public to bypass permission errors.
- Keep gameplay responsive if Firebase is unavailable. Clearly distinguish unsaved local results from successfully saved/shared records.
- Do not write telemetry every frame. Persist meaningful events such as a completed lap, a changed setup, or a finished race.
- Integrate the warm-up with the landing page without obstructing the primary car-wash customer journey.
- Preserve the established app identity, responsive behaviour, offline support, service-worker/cache isolation, and all existing customer/admin functionality.

## 8. Protected PWA installation — do not modify for this work

The approved installation mechanism is protected infrastructure. Racing-game work must not redesign, rewrite, refactor, replace, remove, or otherwise alter the installation UI, `beforeinstallprompt` lifecycle, event listeners, install-card behaviour, responsive positioning, service-worker installation behaviour, manifest, icons, or cache namespaces. Touch installation files only if the product owner explicitly authorizes that specific change. Prefer to identify protected files before editing unrelated application code.

## 9. Warm-up QA acceptance checklist

Do not start the championship layer until the product owner can verify these items on a real phone and desktop where available:

- [ ] Warm-up is discoverable from the landing page and does not obstruct the car-wash journey.
- [ ] Car movement is stable, responsive, and predictable at low and high speed.
- [ ] Acceleration, braking distance, steering, grip, slides, apexes, and corner exits create meaningful choices.
- [ ] Touch controls work without obscuring the track; pause/resume/restart are reliable.
- [ ] Track boundaries and lap detection work, including across the start/finish line.
- [ ] Best-lap timing is accurate enough to compare attempts; invalid/cut laps are handled honestly.
- [ ] Boost has a clear animation and meter and measurably changes acceleration/speed.
- [ ] Every upgrade shows an understandable effect and changes actual driving behaviour.
- [ ] The single flagship warm-up car is visually polished and legible on small screens.
- [ ] High scores save correctly; failures/offline results are labelled accurately and do not silently disappear.
- [ ] High-score comparisons disclose the active upgrade setup or separate records fairly.
- [ ] Loading, empty, error, offline, pause, and completion states are designed and readable.
- [ ] Existing PWA install behaviour is unchanged.
- [ ] Existing booking, service, account, admin, and offline functionality still works.
- [ ] Lint and production build pass; no unverified deployment or device test is claimed.

## 10. Delivery rule

The immediate deliverable is **the warm-up foundation only**. Inspect the current repository before coding, confirm the protected installation files, implement the smallest coherent gameplay slice, run available checks, and report exact branch/commit and test status. The product owner performs QA. Only after approval should the next game layer begin.
