# Vula's Car Wash Racing Game — Product and Gameplay Roadmap

**Status:** Product direction documented; phases and economy require implementation and QA. This document is not a claim that every listed mechanic, leaderboard, multiplayer mode, or reward is already implemented.
**Repository:** `gatshaayanda/vulas-car-wash`
**Primary rule:** Build and get product-owner approval for the solo warm-up driving foundation before expanding the championship or online competition.
**Protected infrastructure:** Do not alter the approved PWA installation mechanism without explicit authorization.

## 1. Product vision

Vula Racing is a mobile-first, F1-inspired arcade racing game inside Vula's Car Wash PWA. It gives customers something genuinely fun to play while waiting for their vehicle, then offers a long-term progression loop: learn to drive, qualify, race, earn prize money, improve the car, advance through four divisions, win championships, and continue competing for personal and shared records.

The game should reward both **driver skill** and **car development**. Upgrades should be visible and materially change driving; good driving should still matter more than blindly buying power. The aspirational flagship car in warm-up defines the reference feel for handling and feedback. Career divisions intentionally restrict the car, equipment, and assistance available to create meaningful progression.

Keep racing optional and isolated from wash bookings, queue requests, accounts, admin operations, notifications, and offline customer workflows.

## 2. Current implementation versus intended target

The current README describes `/games` as a **500 m traffic-and-obstacle warm-up with collision retry, steering, acceleration, braking, and NOS**, and `/games/career` as a separate career route. The intended driving-school warm-up in this roadmap is a repeatable circuit with corner craft, apexes, braking zones, lap timing, and a best-lap record.

Treat that difference as a known product/implementation gap to inspect and close deliberately. Do not claim the circuit, realistic line coaching, all upgrade categories, shared leaderboards, or live player-versus-player racing exists until the code is implemented and verified. Inspect the actual game components before changing the current warm-up, and preserve working behaviour where practical.

## 3. Phase 1 — solo flagship warm-up (the QA gate)

The warm-up is a **solo practice session**. It has no Kago, no Neo, no AI rivals, no qualifying, no division restrictions, and no career prize money. Its job is to teach the controls and let the player experience the best reference car without having to grind or buy upgrades.

### Car and track

- One polished top-division flagship car model, at full reference specification: power, brakes, tyres/grip, steering/handling, and boost are all at their intended 100% baseline.
- A repeatable circuit with straights, varied corners, braking zones, turn-in points, apexes, corner exits, kerbs/track limits, and a start/finish line.
- Mobile-first camera framing, car silhouette, track contrast, HUD, and controls that remain readable on small screens.
- Touch controls for steering, accelerate, brake/reverse where appropriate, boost, pause/resume, and restart; keyboard controls where practical.
- Smooth acceleration, momentum, braking distance, speed-dependent steering, grip loss, and recoverable slides. The flagship is capable, not magical: poor lines and late braking still cost time.
- Clear speed, lap, current/best time, and boost feedback without cluttering the driving view.

### Corner craft and driving feedback

The learning loop is **approach → braking point → turn-in → apex → corner exit**.

- **Racing line:** teach a smooth path through a corner rather than random steering. If a suggested line is shown, it should be a useful guide, not an invisible rail that drives the car for the player.
- **Braking points and distance:** braking early enough to maintain control is usually safer; late braking can gain time but can cause a missed apex or run-wide exit. Speed, momentum, and brake performance must visibly affect stopping distance.
- **Turn-in and steering:** steering response changes with speed; abrupt steering at high speed can overload available grip.
- **Apex:** reward aiming for the useful inside point of a corner and maintaining control through it.
- **Corner exit:** reward unwinding the steering and progressively applying power to carry speed onto the straight.
- **Tyres and grip:** braking, cornering, and acceleration compete for finite grip. Excess demand can produce understeer, oversteer, sliding, or lost time.
- **Kerbs and track limits:** legal kerb use may help the line; corner cutting must not create illegitimate records. Use a clear invalid-lap rule, time penalty, or understandable warning.
- **Boost/NOS:** full flagship warm-up capacity and duration from the start. Boost has a visible meter and strong visual response (rear glow/trails or restrained speed effect) and changes actual acceleration/speed. Good timing matters; the boost should not erase cornering mistakes.
- **Lap feedback:** current lap, best lap, improvement, and sector splits where reliably implemented. A best-lap ghost is a later enhancement if it can run smoothly and fairly.
- **Actionable coaching:** short prompts such as “Brake earlier”, “Apex missed”, “Good exit”, or “Clean lap”, preferably after the relevant corner or lap rather than over the action.

The warm-up provides the best available driving assistance and accurate corner guidance by default. It does not ask players to buy staff support or any performance upgrades. The point is to learn the complete driving system in the reference car and set meaningful lap-time benchmarks.

### Staff / race-engineer assistance

Add a **race engineer / spotter coaching system** as a progression feature. It can remind players of upcoming braking points, corner direction, apexes, and useful boost opportunities—similar to timely race-engineer guidance in real racing.

- In warm-up, coaching is fully enabled and accurate for every player: no upgrade button, paywall, deliberate mistakes, or reduced assistance.
- In career, lower tiers may start with limited, less timely, or less detailed coaching. A staff-attentiveness/effectiveness upgrade improves the timing, relevance, and breadth of guidance.
- Coaching must be generated from the known track layout and player position, not random guesses. It must never confidently announce the wrong turn. If position or track state is uncertain, omit the call rather than invent one.
- Higher-division promotion unlocks a stronger baseline staff package, so players do not need to spend currency to buy back basic competence at the top level. The best divisions should feel more capable by default.
- Keep calls concise, readable, and non-intrusive on mobile. Use a visual cue and optional sound/voice later; never rely on audio alone.
- Coaching helps the player make a decision; it does not steer, brake, or race automatically for them.

## 4. The upgrade model: connect each purchase to driving

Every upgrade must change the underlying car handling or coaching system, show a before/after comparison, and be felt in gameplay. A displayed stat increase without a real effect is not an upgrade.

| Upgrade family | Actual effect | Difference on a weak car |
|---|---|---|
| Engine / power | Acceleration and top speed | Slow acceleration and weaker pace on straights |
| Brakes | Deceleration and braking control | Longer stopping distance; earlier braking needed |
| Tyres / grip | Cornering grip, traction, slide recovery | More understeer/sliding and poorer corner exits |
| Steering / handling | Steering response and precision | Less confidence through linked or tight corners |
| Suspension / stability | Kerb response and stability during direction changes | More unsettled handling on rough or technical sections |
| NOS / boost system | Capacity, duration, recharge, or efficiency | Less boost available or a shorter useful burst |
| Race engineer / staff | Accuracy, timing, detail, and coverage of useful reminders | Fewer proactive cues; player must read the track more independently |

A physical steering-wheel cosmetic may be collectible later, but it must not be confused with a steering/handling upgrade unless it changes the control system in a meaningful way.

### Upgrade and division rules

- Warm-up flagship uses the full reference setup and full boost from the outset. There is no warm-up upgrade shop or upgrade CTA for those performance elements.
- Career begins at a deliberately inferior but playable specification. Lower-tier cars should visibly and behaviourally feel less capable, and lower-tier tracks should test those weaknesses.
- Promotion grants a meaningful baseline improvement in car specification and race-engineer/staff capability. A player should not be forced to grind currency just to make a newly promoted car viable.
- Optional paid upgrades let the player tune or accelerate development within the career's permitted specification. They must not erase all division identity or make driving skill irrelevant.
- Championship event rules determine which car/specification and assistance package is legal. When a champion revisits a lower-division event, make the chosen format explicit: a division-legal challenge uses that division's limits; an open-spec or champion challenge can retain the better car/support and must be recorded in a separate comparison category.
- Keep the garage out of the critical driving loop. Save purchases and loadouts at meaningful boundaries, not on every frame.

## 5. Career structure: four divisions, three tracks each

There are **four divisions × three tracks = 12 division/track combinations**. Track identities should have different driving lessons and layouts, with difficulty increasing without relying only on faster rivals.

Initial track concepts:

1. **Gaborone Dust Loop** — entry circuit for braking basics, simple corners, track limits, and corner exits.
2. **Tlokweng Sprint** — longer straights and linked corners that reward momentum, line discipline, and boost timing.
3. **Makgadikgadi Bend** — a technical circuit with a hairpin, multiple braking zones, and demanding exits.

These are initial identities, not a requirement to duplicate the same geometry twelve times. Each division may use the three core circuits with distinct layouts/conditions or progressively demanding variants, but variants must be clearly identified and timed separately where they affect fairness.

### Weekend and event loop

For each division and track, the intended sequence is:

1. **Practice / warm-up:** practise the layout and improve personal understanding; no qualifying/championship prize money. Practice records may contribute to a separate speculative performance feed.
2. **Qualifying:** a timed session that establishes championship starting positions and awards qualifying prize money.
3. **Championship race:** race against the field, earn race prize money based on finishing position, and accumulate championship progress.
4. **Results and garage:** show finish position, lap/sector performance where available, earnings, points/progression, and any upgrade or promotion unlocked.

Qualifying times must genuinely determine starting positions. Championship results, qualifying results, and practice times must be separate record types and never be blended into one misleading score.

### AI rivals — championship only

Kago and Neo do not appear in the solo warm-up.

- **Kago — The Attacker:** tends to brake late, look for aggressive passing opportunities, and may lose time after overcommitting on a corner exit.
- **Neo — The Smooth One:** tends to brake earlier, choose safer overtakes, and maintain consistent exits and a clean racing line.
- At each meaningful AI decision, there is a 50/50 chance of signature behaviour versus contrasting behaviour. This means approximately half of decision opportunities use the signature style in expectation; it does not guarantee exactly half per race.
- Choose behaviour at a decision window and hold it for that window. Never randomize the choice every frame. Seed randomness in tests where possible.
- Keep each rival recognizable through stable traits while allowing occasional surprises. Avoid arbitrary speed cheating and avoid deliberately turning through the player.

## 6. Economy and progression — confirm values before implementation

The intended economy includes **P250, P500, and P1,000 upgrade purchases**, plus prize money for qualifying and championship results. The existing plan has also mentioned the following provisional payouts:

- Qualifying: P1,000 / P500 / P250 for 1st / 2nd / 3rd.
- Championship race: P2,000 for 1st and P1,000 for 2nd.

These amounts are provisional until reconciled with the product owner's final rules and the existing career implementation. Do not silently treat conflicting values as approved.

Design rules:

- Clearly distinguish race winnings, qualifying winnings, and purchase costs.
- Show the reward before a session and the actual reward after server-verified results.
- A P1,000 purchase should have a meaningful, explainable effect.
- Promotion should award baseline equipment/support and feel like an achievement; optional upgrades should offer choices rather than compulsory repair of an intentionally unusable car.
- Prevent duplicate reward claims, client-forged results, negative balances, and replayed race-session rewards. Server-side validation is authoritative for online career currency and progression.
- Practice/warm-up does not award qualifying or championship money. Any later practice rewards need explicit anti-abuse rules.

## 7. Performance feeds, records, and competitive fairness

The warm-up feed is a **speculative performance/odds signal**, not a claim that practice time predicts the winner with certainty. It should use available lap times and other verified performance indicators to communicate who appears quick, while acknowledging that it does not know a driver's full skill, decision-making, loadout, or future race conditions.

The product should eventually support distinct categories such as:

- Personal bests and practice lap records per track/layout.
- Practice/speculative feed and estimated contenders, clearly labelled as estimates.
- Qualifying times and resulting starting positions.
- Championship race results, standings, titles, and career achievements.
- Stock/spec or division-legal time rankings, where entrants use comparable equipment.
- Open-upgrades rankings, where different earned loadouts are permitted and shown.
- Online head-to-head/multiplayer results once real-time multiplayer is implemented and verified.
- All-time top times and champions, with track/version, car/spec, upgrade loadout, and event type attached to each record.

Never compare times from materially different tracks, track versions, game physics, event types, or car classes as if they were equivalent. The ranking UI must make the category obvious and allow players to inspect the car and upgrades behind a result. A player who has reached the top division should be easy to identify and challenge, but titles, lap records, and current rankings are distinct achievements.

### Shared feed and privacy

Only publish player information intended for the feed, such as a chosen display alias and permitted result summaries. Do not expose private account details, tokens, booking information, or internal racing profiles. Define a clear opt-in/visibility policy before public profile or social features. Offline results remain local and must not be described as shared, verified, or eligible for online rewards.

## 8. Online play: staged, real, and honest

“Online player versus player” means actual players competing, not only AI rivals or a locally simulated result. Treat this as a later technical milestone after solo driving, career progression, and secure results are stable.

- First ship server-backed profiles, validated race sessions, qualifying/race results, progression, and leaderboard summaries using the existing `/api/racing` architecture where appropriate.
- Then implement real-time multiplayer as a distinct milestone: room/match creation, joining by invite and matchmaking, authoritative or validated race state, disconnect/rejoin handling, result validation, and abuse/race-integrity protections.
- Do not label ghost/time challenges as real-time multiplayer. Ghosts and recorded challenges can be useful earlier and cheaper, but must be named accurately.
- Keep a clear distinction between device-local offline play, submitted/pending state, server-confirmed results, and real-time live matches.
- Do not write telemetry every frame. Persist meaningful events such as completed laps, qualifying results, completed races, purchases, and progression changes.
- Keep racing collections server-owned where the current architecture requires it. Inspect Firebase rules and API validation before changing data contracts; never make collections public to bypass permission errors.

## 9. Later modes: document now, build after core racing

Once the warm-up and championship have passed QA, the shared driving foundation can support additional arcade modes:

- **Getaway Driver:** route choices, timed escape objectives, traffic/obstacles, and control under pressure.
- **Police Escape:** pursuit pressure, evasive driving, boost management, and escape objectives.
- Other short, optional waiting-time games may be considered after evidence from actual use.

These modes should reuse proven controls/physics where appropriate but have their own rules, scoring, records, and acceptance tests. They are not part of the first warm-up delivery and must not delay it.

## 10. Mobile-first UX and research principles

Research should inform decisions, but it must be validated against real playtests rather than treated as a substitute for QA.

- Make the next action obvious. Start practice quickly; put deep setup and stats outside the live driving view.
- Prioritize thumb reach, large reliable touch targets, no accidental browser scrolling/zooming while controlling the car, and controls that do not obscure upcoming corners.
- Maintain readable contrast between track surface, racing line, kerbs, hazards, car, HUD, and feedback.
- Keep critical cues concise and timely. Avoid flashing effects or screen shake that impair control; respect reduced-motion settings where feasible.
- Make failures understandable: missed apex, late braking, invalid lap, offline save, and failed submission should each have specific feedback.
- Test on representative low- and mid-range Android devices, installed PWA and browser, and desktop/keyboard where practical. Track frame rate, control latency, layout clipping, and battery/thermal issues.
- Use usability evidence and suitable research on mobile game controls, feedback timing, cognitive load, and motivation. Do not add dark patterns, forced installation, or manipulative pay-to-win mechanics.
- The car-wash booking journey remains primary. The game must be easy to enter and leave without losing customer context.

## 11. Protected PWA installation — do not modify for racing work

The approved installation mechanism is protected infrastructure. Racing work must not redesign, rewrite, refactor, replace, remove, or otherwise alter installation UI, `beforeinstallprompt` lifecycle, event listeners, branded install-card behaviour, responsive positioning, service-worker installation behaviour, manifest, icons, or cache namespaces. Identify protected files before code changes and leave them untouched unless the product owner explicitly authorizes a specific installation change.

## 12. Delivery phases and QA gates

### Phase A — inspect and stabilize solo warm-up

Inspect current `/games` implementation and its relationship to the intended circuit-based warm-up. Preserve working controls where appropriate; build the lap-based driving school as the smallest coherent, testable slice.

Acceptance:
- [ ] One flagship reference car; no AI rivals, Kago, Neo, career restrictions, or prize money.
- [ ] Repeatable circuit with braking zones, apexes, corner exits, kerbs/limits, and start/finish.
- [ ] Stable mobile controls and responsive visual hierarchy.
- [ ] Acceleration, braking distance, steering, grip, slides, boost, and lap timing are meaningful.
- [ ] Accurate, always-available corner coaching; no coaching upgrade purchase in warm-up.
- [ ] Full baseline performance and boost are available immediately.
- [ ] Invalid/cut laps and timing are handled fairly.
- [ ] Personal records and save/error/offline states are truthful.
- [ ] Install mechanism and all existing customer/admin functionality remain unchanged.
- [ ] Lint, typecheck, identity verification, and production build pass where feasible; owner tests on actual devices.

### Phase B — garage and career car specifications

Implement real upgrade effects, costs, before/after stats, loadouts, baseline spec by division, promotion packages, and staff/race-engineer assistance levels. Confirm economy rules before awarding money.

### Phase C — qualifying and championship

Add the three circuit identities/variants across four divisions, qualifying, grid order, race loop, Kago and Neo, rewards, standings, and champion progression.

### Phase D — server-verified competitive records

Verify profile ownership, race sessions, anti-replay protections, record categories, visible loadouts, speculative feed wording, and staff/admin visibility. Keep offline results local unless a separately secure reconciliation design is approved.

### Phase E — real-time multiplayer

Build actual live player-versus-player matches, then validate disconnect/reconnect, match integrity, results, and ranking rules. Do not present this as complete until end-to-end tests prove it.

### Phase F — additional modes

Only after the above core has been approved, build Getaway Driver, Police Escape, and other documented modes.

## 13. Data, app integration, and delivery rules

- Keep racing data isolated from wash bookings, receipts, customer requests, and staff operations.
- Preserve server-owned career progression/rewards and existing ownership checks. Inspect `src/app/api/racing/route.ts`, Firebase configuration, and rules before changing data contracts.
- Keep the game responsive if Firebase or network services are unavailable; label local and server-confirmed data accurately.
- Avoid frame-by-frame database writes and expensive repeated reads.
- Integrate access from the landing page without making the game dominate or obstruct the core car-wash journey.
- Never claim tests, synchronization, multiplayer, deployment, or device behaviour that has not been verified.
- Product owner handles Vercel deployment unless explicitly delegated.

At each checkpoint report separately: changed/committed code or docs; pushed branch and exact commit; tests/build results; production deployment status; outstanding configuration; and exact QA steps.
