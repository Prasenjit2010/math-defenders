# Math Defenders: Clockwork & Cardboard Edition

A tabletop tower defense game for K–6 students. Solve math problems to earn energy, then build and evolve brass-and-wood towers that guard a felt path across a cardboard board. There are 108 tower evolutions, 18 math topics and a 100-wave campaign.

**To play, double-click `index.html`.** It needs no install, no server and no internet connection.

## Session only, by design

- It saves nothing: no `localStorage`, `sessionStorage`, cookies, IndexedDB, database or network calls. Every value lives in JavaScript variables and disappears when the tab closes.
- It loads nothing from the internet: no fonts, no libraries, no images. Everything is drawn with canvas code.
- The browser test counts every storage call and network request. Both are zero.

## How to play

1. Enter a **display nickname**, pick a **math level** and **battlefield**, and optionally **jump to wave 25, 50 or 75** to practice later stages.
2. Answer problems in the bottom bar (click, or press `1` `2` `3`). Correct answers give energy, and fast answers build a streak worth up to ×2. A wrong answer jams the bar for 1.2 seconds and shows the right answer.
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

## 18 math topics (`js/questions.js`)

- **K–1:** Number Bonds to 10, Comparing Numbers (<, >, =), Missing Addends, Add & Subtract within 20
- **2–3:** 2-Digit Regrouping, Place Value, Multiplication & Fact Families (2×–12×), Division with Remainders, Rounding to 10 & 100
- **4–5:** Equivalent Fractions, Fraction Addition, Decimals & Money, Order of Operations, Area & Perimeter, Factors & Multiples
- **6:** Ratios & Rates, Negative Numbers, Percent of a Number

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

- After clearing wave 20 the game pauses on a **"Milestone Reached: Wave 20!"** card. It shows a **Create Account (Coming Soon)** preview and a **Keep Playing to Wave 100** button.
- **Teacher PIN:** the first time Teacher Mode opens, the teacher creates a 4–6 digit PIN (typed twice). It's asked for every time Teacher Mode opens after that. It lives in memory only, so it resets when the tab closes. It keeps students out of the teacher view; it isn't real account security.
- **Class code:** a 6-character code made when the page opens, shown in the Teacher panel with **New code** and **Copy**. It also fills the Create Account preview card. It's per session and doesn't connect students yet; that needs the account system.
- **Export CSV:** downloads a report of this session (student, class code, wave, rating, accuracy, streaks, accuracy by topic, weakest facts). This is the only time a file is written, and only when the teacher clicks the button.
- **Teacher Mode** is a **Student / Teacher** tab on the start screen (top left) and a **Teacher** button in the game's top bar. From the start screen, a teacher can set the math topic before the student begins. During a game it opens the Class Preview and pauses play. Teachers can change the active math topic on the spot and see live accuracy, current and best streak, problems answered, accuracy by topic, the weakest math facts and what is being re-practiced.
- The **session rating** (Elo) and its 7 rank badges (Rookie → Legend) update live: correct answers and cleared waves raise it, and misses and leaks lower it.

## Files

```
index.html        screens and modals
styles.css        Clockwork & Cardboard theme
js/towers.js      drawing helpers, 12 chassis, 108 evolutions, stats, tower art
js/questions.js   18 topic generators, distractors, session mastery tracking
js/waves.js       9 enemy types, 100-wave campaign, milestones, enemy art
js/engine.js      maps, simulation (all 12 attack types, statuses, camo, shields), board renderer
js/main.js        UI, math bar, Almanac, Teacher view, rating, sound, main loop
tools/balance-sim.js  headless balance test (Node)
```

Each script shares one `MD` namespace and loads as a plain `<script>`, not `type="module"`. Chrome blocks ES modules on pages opened straight from a file (`file://`), so this is what lets `index.html` run with a double-click. The code uses modern JavaScript (classes, arrow functions, `const`/`let`) throughout.

## Built to handle thousands of students

Everything runs in each student's own browser, so there is no server to overload. Enemies (240), shots, effects and puddles are capped. In testing, 157 enemies on screen took 0.15 ms per update. Each frame's time step is clamped, a bad frame is caught and logged instead of freezing the game, and the game pauses when the tab is hidden.
