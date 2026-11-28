# Math Defenders: Clockwork & Cardboard Edition

A tabletop tower defense game for K–6 students. Solve math problems to earn energy, then build and evolve brass-and-wood towers that guard a felt path across a cardboard board. There are 108 tower evolutions, 18 math topics and a 100-wave campaign.

**Play online: https://mathdefenders.vercel.app** (hosted free on Vercel; it updates automatically when files change on GitHub). A backup copy runs at https://prasenjit2010.github.io/math-defenders/. Or double-click `index.html`. It needs no install. With no internet connection it runs session-only.

## Saving progress with a class code (optional)

- A teacher creates a class in Teacher Mode and gets a 6-character class code. Students type that code and a nickname on the start screen. **No emails, real names, sign-ins or accounts.**
- **Student link:** the Teacher panel shows a link like `mathdefenders.vercel.app/?class=K7QM2P` with a **Copy** button. Opening it fills in the class code for the student, so they only type a nickname.
- **Teacher link:** `mathdefenders.vercel.app/?teach=K7QM2P` reopens the class on any day or device. Open it, type the class PIN, and the roster appears. Bookmark it.
- The roster refreshes by itself every 45 seconds while the Teacher panel is open, for 15 minutes; after that, click **Refresh**. A student appears as soon as they join, and their progress saves after their first wave and then every 3 waves.
- Class codes never use O, I, 0 or 1, so they can't be confused with each other. If a student types one of those, the game tells them.
- The nickname's rating, best wave, games played, accuracy by topic and weakest facts are saved to the class on Supabase. Saves go out after the first wave and then every 3 waves, at game end, on quit and when the tab closes. Each save carries only what changed since the last one.
- Without a class code, or when the server can't be reached, the game plays session-only exactly as before.
- Nothing is ever stored in the browser: no `localStorage`, `sessionStorage`, cookies or IndexedDB. The game loads no fonts, libraries or images from the internet.

### Setting up the class server

1. Create a Supabase project, open **SQL Editor**, paste in `supabase/schema.sql` and run it.
2. Copy the project URL and the **publishable** key into `js/config.js`. This copy is already connected to the `math-defenders` project.
3. Leave `url` empty in `js/config.js` to turn class saving off completely.

### How it's protected

- Both tables have Row Level Security on with no policies, so the public key can't read or change them directly. The game can only call six database functions, and each one checks its inputs.
- The class PIN is stored as a bcrypt hash. Ten wrong PINs lock the class for 15 minutes.
- Saves are clamped to sensible values: a rating can move at most 400 points per save, and "correct" can never exceed "answered".
- Each class holds up to 200 students, and at most 60 classes can be created per minute across the whole server.
- A nickname has no password, so anyone with the class code who types the same nickname plays as that student. Teachers can remove nicknames from the roster.

### Built for 10,000 students

Each student sends a save about every 2 minutes, so 10,000 students playing at once make about 90 small requests per second. On a 2-core test machine with 10,000 students in 400 classes, the database handled about **5,000 saves per second** (4 ms each) and **12,500 joins per second**. On the live Supabase Free project, 500 students joining at the same instant all succeeded (slowest 8 seconds), and 500 simultaneous saves all succeeded (slowest 6 seconds). When the server is busy, the game retries after a random short wait so students don't all retry at the same instant. The game itself never waits on the server: play continues while saves happen in the background.

On Supabase's **Free plan**, a project pauses after 7 days without activity (for example over a school break) and must be restored from the Supabase dashboard. The Pro plan ($25/month) never pauses.

## How to play

1. Enter a **display nickname**, pick a **math level** and **battlefield**, and optionally **jump to wave 25, 50 or 75** to practice later stages.
2. Answer problems in the bottom bar (click, or press `1` `2` `3`). Correct answers give energy, and fast answers build a streak worth up to ×2. An answer counts as fast within 10 seconds (13 seconds for medium problems, 18 for long ones); the bar under the problem shows the time left. A wrong answer jams the bar for 1.2 seconds and shows the right answer.
3. Click a wooden pad to build one of 12 towers. Click a tower to choose an upgrade path, then evolve it through 3 tiers.
4. `F` cycles 1×/2×/3× speed, and `P` or `Esc` pauses. The pause menu can also jump to a milestone wave.

## 108 towers (`js/towers.js`)

12 chassis × 3 paths × 3 tiers = 108 evolutions, each with its own name, stats and canvas add-ons.

| Chassis | Attack | Path A, Heavy Damage | Path B, Crowd Control | Path C, Speed & Multi-Shot |
|---|---|---|---|---|
| Clockwork Dart Turret | rapid darts | Brass Bolter → Heavy Repeater → Cannonade Colossus | Barbed Darter → Spyglass Darter → Stunlock Sentinel | Twin-Spring Turret → Gatling Gearwork → Hailstorm Engine |
| Cryo Frost Emitter | slowing pulse | Icicle Lancer → Glacier Hammer → Avalanche Core | Deep Chill → Flash Freezer → Absolute Zero Spire | Frost Ticker → Sleet Spinner → Blizzard Engine |
| Alchemist Mortar | splash flasks | Big Flask → Brimstone Bombard → Philosopher's Payload | Ember Tincture → Molten Mixture → Napalm Cauldron | Double Distiller → Bubbling Barrage → Thousand-Flask Volley |
| Tesla Arc Spire | chain lightning, sees camo | High-Voltage → Thunder Column → Zeus Dynamo | Static Snare → Arc Web → Storm Lattice | Rapid Relay → Spark Cascade → Lightning Loom |
| Prism Laser Beacon | beam that heats up | Focused Prism → Solar Lance → Sunspear Array | Searing Lens → Shred Ray → Piercing Spectrum | Split Prism → Rainbow Fan → Kaleidoscope Cannon |
| Gravity Well Generator | pulls enemies back | Dense Core → Crusher Well → Event Horizon | Undertow Coil → Riptide Engine → Rewind Singularity | Pulse Gyro → Quick Orbit → Spiral Accelerator |
| Sawblade Launcher | bouncing blades | Serrated Disc → Ripper Wheel → Buzzsaw Behemoth | Jagged Edge → Ricochet Rack → Boomerang Mill | Twin Blades → Blade Carousel → Sawstorm |
| Honey Glue Catapult | sticky puddles | Hot Honey → Scalding Syrup → Molasses Meteor | Sticky Patch → Tar Trap → Amber Prison | Quick Lob → Drizzle Drum → Syrup Monsoon |
| Sniper Railgun | whole board, armor-piercing crits | Long Rifle → Siege Rail → Doomsday Accelerator | Spotter Scope → Armor Breaker → Paralyzer Rail | Bolt-Action → Semi-Auto → Coil Storm |
| Tornado Fan | knocks enemies back | Gale Blower → Cyclone Cannon → Typhoon Turbine | Gust Snare → Downdraft → Hurricane Wall | Whirligig → Twin Fan → Vortex Engine |
| Beacon Boost Tower | buffs nearby towers, reveals camo | War Drum → Battle Standard → Grand Commander | Watchtower Lamp → Lighthouse Eye → All-Seeing Beacon | Tempo Bell → Overclock Chime → Clockwork Conductor |
| Mana Siphon | bonus energy | Coin Funnel → Gilded Siphon → Midas Engine | Scholar's Hourglass → Wisdom Well → Grand Library | Trickle Tap → Steady Spring → Mana Geyser |

The **Tower Almanac** (book icon) shows every evolution with its art, stats and cost, plus an enemy guide.

## 18 math topics, 77 kinds of question (`js/questions.js`)

Each topic mixes several kinds of question, with new numbers every time:

- **K–1**
  - Number Bonds to 10: `7 + ? = 10`, `10 − 4 = ?`, which pair makes 10
  - Comparing Numbers: `<` `>` `=`, which number is greatest or least
  - Missing Addends: `? + 5 = 12`, `5 + ? = 12`, `14 − ? = 9`
  - Add & Subtract within 20: plain facts, three numbers, short story problems
- **2–3**
  - Add & Subtract with Regrouping: 2-digit and 3-digit
  - Place Value: digit in a place, value of a digit, build a number, expanded form, 10/100/1,000 more or less
  - Multiplication & Fact Families (2×–12×): facts, arrays, missing factor, fact families, division, equal groups
  - Division with Remainders: remainders, exact division, how many left over
  - Rounding to 10, 100 & 1,000
- **4–5**
  - Equivalent Fractions: missing numerator, which fraction is equal, simplify, which is greater
  - Fraction Addition: like and unlike denominators, subtraction, `1 − 3/8`
  - Decimals & Money: adding money, making change, cost of several items, adding and subtracting decimals
  - Order of Operations: with `×`, `÷` and parentheses
  - Area & Perimeter: rectangles, squares, missing side from area or perimeter
  - Factors & Multiples: factors, multiples, GCF, LCM, prime numbers
- **6**
  - Ratios & Rates: equivalent ratios, unit price, speed, ratio word problems
  - Negative Numbers: add, subtract, multiply, which is greater
  - Percent of a Number: percent of, what percent, sale price after a discount

**Every question has exactly one right answer.** Before each release, two test programs check every kind of question, 20,000 or more of each. The first checks the answer choices. The second solves each question on its own, without using the game's code, and confirms exactly one choice is correct. For example, "What is the value of the 2 in 8,223?" can't appear, because the 2 is in two places. Wrong choices are never negative except in the negative-numbers topic. They never include a second fraction with the same value, like 2/4 next to 1/2.

```
node tools/check-choices.js   # answer choices: 3 different choices, answer listed once, no odd values
node tools/check-answers.js   # independent solver: exactly one correct choice
```

**Session mastery:** when a student misses a problem type, a similar problem comes back two or three questions later (marked "Practice round"). It keeps coming back until they get it right.

## 100-wave campaign (`js/waves.js`)

| Waves | Era | What's new |
|---|---|---|
| 1–24 | Foundations | Paper Scouts, Wooden Shieldbearers, Clockwork Swarms, Gearlord boss every 10 waves |
| 25–49 | First Major Spike | Iron Ironclads (heavy armor: Railgun/Mortar), Camo Moths (need Tesla or a Beacon), Shield Wardens (Tesla breaks shields) |
| 50–74 | Tactical Mastery | Regenerating bosses, Brass Knights (immune to slow, stun and push), dense swarms |
| 75–100 | Nightmare Gauntlet | Mega-Dreadnoughts every 5 waves, speed-boosted swarms, heavy energy pressure |

**Balance** (headless simulation, `tools/balance-sim.js`): with a sensible build plan, a slow student (one answer every 6 seconds, 70% right) reaches about wave 45, an average student (4 seconds, 80%) about wave 60, and a fast student (2.5 seconds, 92%) about wave 70. An anti-armor layout (Railguns, Mortars, Lasers and Beacons) with a fully upgraded board reaches about wave 79. No simulated run has cleared wave 80, so wave 100 is meant to need perfect play.

```
node tools/balance-sim.js <map> <startWave> <secondsPerAnswer> <accuracy> [runs]
node tools/balance-sim.js meadow 1 4 0.8 3
```

## Wave 20 milestone and Teacher Mode

- After clearing wave 20 the game pauses on a **"Milestone Reached: Wave 20!"** card. It shows whether progress is being saved to a class and a **Keep Playing to Wave 100** button.
- **Teacher PIN:** the first time Teacher Mode opens on a device, the teacher creates a 4–6 digit PIN (typed twice). It's asked for every time Teacher Mode opens after that. On that device it lives in memory only, so it resets when the tab closes.
- **Create class:** makes a saved class whose PIN is the teacher PIN just entered. **Open a class** on any device with the class code and PIN. The panel shows the class roster (rating, best wave, problems answered, accuracy, last played) with **Refresh**, **Remove** for each student, and **Export class CSV**.
- **Export CSV:** downloads a report of this device's session. **Export class CSV** downloads the whole roster with accuracy by topic and each student's weakest facts. Files are written only when the teacher clicks a button.
- If no class server is configured, the panel shows a per-session class code instead (with **New code** and **Copy**).
- **Teacher Mode** is a **Student / Teacher** tab on the start screen (top left) and a **Teacher** button in the game's top bar. From the start screen, a teacher can set the math topic before the student begins. During a game it opens the Class Preview and pauses play. Teachers can change the active math topic on the spot and see live accuracy, current and best streak, problems answered, accuracy by topic, the weakest math facts and what is being re-practiced.
- The **session rating** (Elo) and its 7 rank badges (Rookie → Legend) update live: correct answers and cleared waves raise it, and misses and leaks lower it.

## Files

```
index.html        screens and modals
styles.css        Clockwork & Cardboard theme
js/config.js      Supabase project URL and publishable key (empty = offline)
js/cloud.js       class saving: fetch calls to the database functions, retries
supabase/schema.sql  tables, security and functions for class saving
js/towers.js      drawing helpers, 12 chassis, 108 evolutions, stats, tower art
js/questions.js   18 topic generators, distractors, session mastery tracking
js/waves.js       9 enemy types, 100-wave campaign, milestones, enemy art
js/engine.js      maps, simulation (all 12 attack types, statuses, camo, shields), board renderer
js/main.js        UI, math bar, Almanac, Teacher view, rating, sound, main loop
tools/balance-sim.js  headless balance test (Node)
tools/check-choices.js  question check: answer choices
tools/check-answers.js  question check: independent solver
```

Each script shares one `MD` namespace and loads as a plain `<script>`, not `type="module"`. Chrome blocks ES modules on pages opened straight from a file (`file://`), so this is what lets `index.html` run with a double-click. The code uses modern JavaScript (classes, arrow functions, `const`/`let`) throughout.

## Built to handle thousands of students

The game runs in each student's own browser, and class saving is small, occasional and never blocks play (see above). Enemies (240), shots, effects and puddles are capped. In testing, 157 enemies on screen took 0.15 ms per update. Each frame's time step is clamped, a bad frame is caught and logged instead of freezing the game, and the game pauses when the tab is hidden.
