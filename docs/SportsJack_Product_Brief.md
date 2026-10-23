# SPORTSJACK
## Product Brief — December 2025

---

## Tagline
**Live Poker Meets Real-Time Sports.** Play Texas Hold'em where the cards ARE NFL players and their values change in real-time with their fantasy performance.

**Platform:** Mobile web (MVP) + Native app (Phase 2). Crypto-powered on Solana.

**Status:** Pre-development. High-fidelity gameplay mockup complete. Ready for Planning Phase.

---

## 1. EXECUTIVE SUMMARY

SportsJack is a real-time competitive gaming platform that merges Texas Hold'em poker mechanics with live NFL fantasy statistics. Players build poker hands where cards ARE actual roster players, and hand values dynamically shift based on real-time performance. Each quarter of an NFL game equals one poker hand. Settlement is via cryptocurrency (USDC on Solana).

### Core Innovation
Unlike traditional DFS (which creates engagement pre-game) and poker apps (which ignore sports), SportsJack creates engagement DURING the game by making hand strength dependent on live player performance. **Card volatility = sports volatility.**

---

## 2. PROBLEM & OPPORTUNITY

### 2.1 The Problem

- **DFS engagement dies during the game.** Players draft on Sunday morning, then wait 6+ hours for results. No interaction during live action.
- **Poker apps ignore sports.** Players who love both poker AND sports must choose—they can't combine them.
- **Sports betting is static.** You pick a winner/spread, then watch. No dynamic gameplay that evolves with the game.
- **Crypto gambling lacks compelling mechanics.** Bitcoin poker apps exist, but they're just poker with crypto payment—not novel gaming experiences.

### 2.2 Market Opportunity

| Market | Size | ARPU |
|--------|------|------|
| Fantasy Sports (US/Canada) | 35M players (up from 9M in 2005) | $467.60/year |
| Online Poker (Global) | ~100M players | Highly variable |
| Sports Betting (Legal US) | ~40M active bettors | $100-1000/year |

**SportsJack targets the intersection:** Fantasy sports enthusiasts (18-34, male-dominated, $92K+ household income) who also gamble and use crypto.

---

## 3. CORE MECHANICS

### 3.1 The Game Loop (Per Quarter)

1. **KICKOFF:** Each player is dealt 2 hole cards (2 different NFL roster players). Cards are random.

2. **WATCHING (0:00-2:00 remaining):** Players passively watch. Card values update in real-time based on live fantasy points (passing yards, touchdowns, receptions, etc.). No action required.

3. **2-MINUTE WARNING:** Betting window opens. Flop (3 community cards) deals immediately.

4. **BETTING ROUND 1:** Players fold, call, or raise. Betting continues for ~30 seconds.

5. **TURN (4th community card):** Deals at ~80 seconds remaining. Another betting round.

6. **RIVER (5th community card):** Deals at ~40 seconds remaining. Final betting round.

7. **SHOWDOWN:** Game clock hits 0:00. Best 5-card hand wins pot. House takes 8-12% rake. Winner receives USDC to wallet.

8. **REPEAT:** Q2, Q3, Q4 follow the same pattern. **4 hands per game, 3+ NFL games per day = 12+ hand opportunities/day.**

### 3.2 Hand Strength Calculation

**Hand value = Sum of fantasy points of your 2 hole cards + all community cards revealed so far.**

Texas Hold'em poker hand rankings apply (pair, two pair, three-of-a-kind, straight, flush, full house, four-of-a-kind, straight flush). Highest hand wins.

### 3.3 Betting Window Timing

Only bet during 2-minute warning. This creates a natural checkpoint and prevents constant UI interaction. Players watch the game, then make one decision per quarter.

**Quick bet buttons:** 25%, 50%, 75%, Pot. Custom input available. Min bet = $10, Max bet = player's stack.

---

## 4. USER EXPERIENCE

### 4.1 User Journey

1. Land on app → Connect Phantom/MetaMask wallet → Deposit USDC
2. Browse live NFL games (with odds, point spreads, player stats)
3. Select game & buy-in amount (e.g., $50 buy-in into a table with 6 players)
4. Watch pre-game analysis, wait for kickoff
5. At kickoff: Deal hole cards. Watch game, monitor card values.
6. At 2-min warning: Tap into betting modal, make quick bet decision
7. At 0:00: Hand resolves. See winner, payout, new standings
8. Repeat for Q2, Q3, Q4. View stack, cash out to wallet, or keep playing.

### 4.2 Screens

| Screen | Purpose | Status |
|--------|---------|--------|
| Landing Page | Wallet connect, explainer | Wireframe only |
| Game Lobby | Browse games, select buy-in | Wireframe only |
| Gameplay Screen | Real-time game state, betting modal | ✅ High-fidelity interactive mockup |
| Hand Result | Show winner, payout, next hand | Wireframe only |
| Account Dashboard | Stats, history, withdraw | Wireframe only |

---

## 5. TECHNICAL ARCHITECTURE

### 5.1 Stack

- **Frontend:** React/Next.js (responsive mobile-first)
- **Backend:** Node.js + Express
- **Real-time:** WebSocket (game state updates, stat feeds)
- **Blockchain:** Solana (USDC settlement, instant finality)
- **Database:** PostgreSQL (game state, user accounts, history)
- **Stats API:** ESPN (real-time player stats, ~10-second polling)

### 5.2 Key Flows

#### Crypto Settlement
User deposits USDC → Held in escrow smart contract → On hand resolution, winner's USDC is released directly to wallet (instant, no intermediary).

#### Real-time Stats
ESPN API polls every 10 seconds → Card values calculate based on fantasy points (PPR scoring) → WebSocket broadcasts to all clients → UI updates smoothly (animated transitions).

#### Hand Resolution
At 0:00 game clock, server evaluates all hands → Applies Texas Hold'em ranking rules → Identifies winner → Calculates rake → Sends settlement TX to Solana.

---

## 6. MONETIZATION

| Revenue Stream | Mechanism | Est. % |
|---|---|---|
| House Rake (Primary) | 8-12% of winning pot | 70% |
| Cosmetic Skins (Future) | Card designs, avatars, themes | 15% |
| Premium Passes (Future) | Seasonal battle pass + leaderboards | 10% |
| Sponsorships (Long-term) | Team/Player branded cards | 5% |

**Example:** 100K weekly users, 4 games per event, $500 average pot per hand → $100M annual volume → $8-12M annual rake.

---

## 7. SUCCESS METRICS (MVP PHASE)

- **User Acquisition:** 100+ sign-ups in first week
- **Engagement:** 80%+ of Q1 players return for Q2
- **Monetization:** $500+ weekly rake (covers infrastructure costs)
- **Technical:** Zero crashes, <100ms latency, stats update <5 seconds of live play
- **Retention:** 40%+ DAU/MAU (daily active / monthly active)

---

## 8. MVP SCOPE (WHAT WE'RE BUILDING)

### Included in MVP
- Landing page + wallet connection (Phantom, MetaMask)
- Game lobby (list of live NFL games with stats)
- Buy-in flow (select game + amount)
- Real-time gameplay screen (hole cards, community cards, betting modal)
- Hand resolution & payout
- Account dashboard (balance, history, withdraw)
- Multi-sport: NFL only (Phase 1). NBA/NCAAFB in Phase 2.
- Crypto: USDC on Solana only. Fiat onramp in Phase 2.

### NOT in MVP (Phase 2+)
- Cosmetic skins/card designs
- Leaderboards / seasonal rankings
- Referral program
- Mobile native app (iOS/Android)
- Tutorials / onboarding videos
- Social features (invite friends, watch friends' games)

---

## 9. COMPETITIVE LANDSCAPE

### 9.1 WSOP x NFL (Playtika)

**What They Do:** Cosmetic overlay. NFL-themed avatars, branded tournaments, collectible cards. Standard poker, no live stat integration. Limited-time event (Nov 2025 - Feb 2026).

**Why We're Different:** Core mechanic IS real-time stats. Hand strength changes as players accumulate fantasy points. Card volatility = sports volatility. **Permanent offering, not seasonal.** LIVE ENGAGEMENT during game, not pre-game cosmetics.

### 9.2 DraftKings / FanDuel

**What They Do:** Draft-based fantasy. Players assemble lineup pre-game. Score resolved post-game. No engagement during.

**Why We're Different:** Engagement DURING the game. Quarters, not full games. Poker mechanics (skill + strategy + luck). Crypto-native (no fiat payment friction).

### 9.3 PokerStars / ACR (Online Poker)

**What They Do:** Pure poker. No sports context. Players engage for hours in ring games / tournaments.

**Why We're Different:** Sports + poker merged. Short sessions (2 minutes per hand). Real-time volatility tied to live events. Crypto-native. Timely (follow game seasons).

---

## 10. RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Regulatory | Crypto gambling scrutiny, US state licensing | Operate in compliant jurisdictions, monitor legal changes, fiat ramp in Phase 2 |
| Technical | Real-time stat feed failures, latency issues | Dual data feeds, fallback to manual, auto-pause on feed loss |
| Market | Crypto adoption barrier, user education | Educational onboarding, fiat ramp ASAP, target crypto-native users first |
| UX | Game complexity, decision fatigue | Clear UI, preset buttons, 2-min window limits decisions, test with users |

---

## 11. TIMELINE & ROADMAP

### Phase 1: MVP (Weeks 1-12)

- **Weeks 1-3:** Planning (tech specs, API mapping, workflow design)
- **Weeks 4-6:** Solutioning (architecture design, UX wireframes, dev breakdown)
- **Weeks 7-11:** Implementation (build landing, lobby, gameplay, settlement)
- **Week 12:** Testing & launch (internal QA, fix bugs, soft launch)

**Target launch:** ~Q1 2026 (align with NFL playoffs / early next season)

### Phase 2: Growth & Features (Weeks 13-26)

- Cosmetic skins + card designs
- Leaderboards + seasonal rankings
- Fiat onramp (Stripe / credit card)
- Native iOS/Android apps
- Additional sports (NBA, NCAAFB)

---

## 12. REQUIRED RESOURCES

### Team (Minimum)

- 1 Full-stack developer (React/Node)
- 1 Blockchain engineer (Solana integration)
- 1 Designer/UI engineer
- 1 QA engineer
- 1 Product manager / yourself

### Infrastructure

- AWS / Vercel hosting ($500-1000/month during MVP)
- PostgreSQL DB ($50-200/month)
- ESPN API key (free tier)
- Solana RPC (Helius / QuickNode, ~$200/month)
- Legal / compliance review ($5-10K one-time)

### Budget Estimate

**Team cost (12 weeks):** $120K-180K
**Infrastructure + legal:** $15K
**Total:** ~$150-200K for MVP

---

## 13. NEXT STEPS

1. **Validate gameplay mockup** with 5-10 target users (fantasy enthusiasts, poker players)
2. **Finalize decision:** Proceed with full build OR pivot
3. **If proceed:** Initiate Planning Phase (tech specs, API mapping, detailed wireframes)
4. **Assemble core team** (full-stack dev, blockchain eng, designer, PM)
5. **Conduct legal review** (crypto gambling compliance, jurisdiction strategy)
6. **Begin implementation** on Week 1 of Planning Phase

---

## Appendix: Context from This Session

### Gameplay Screen Enhancements (Already Completed)
- ✅ Community cards reveal during betting (flop → turn → river)
- ✅ Preset betting buttons (25%, 50%, 75%, POT)
- ✅ Custom bet input field
- ✅ Player photos (emoji avatars for MVP, replaceable with headshots)
- ✅ Mobile optimization (responsive, touch-optimized, 48px+ targets)
- ✅ Real-time stat animations (up/down arrows, smooth transitions)

### Deliverables Created
1. **SportsJack_GameplayV2.jsx** — React component with full functionality
2. **SportsJack_GameplayV2.html** — Interactive browser mockup (open and test immediately)
3. **GAMEPLAY_SCREEN_DESIGN_DECISIONS.md** — Deep dive into every design decision with research backing
4. **SportsJack_Product_Brief.docx** — This brief in professional Word format
5. **SportsJack_Product_Brief.md** — This brief in Markdown (easy to share via GitHub/Slack)

### Design Philosophy
- **Accessibility first:** Color-blind safe, 4.5:1 contrast ratio, 48px+ touch targets
- **Mobile-first:** Responsive 320px → 2560px, hardware-accelerated animations
- **Vegas aesthetic:** Dark theme, neon accents (cyan/lime/orange/purple), monospace font
- **Poker tradition:** Your hand is center stage, community cards are supporting, pot is always visible
- **Fast & responsive:** No external images, CSS-only animations, <5s stat updates

### Market Differentiation
| Competitor | Engagement | Mechanics | Crypto | Timing |
|---|---|---|---|---|
| WSOP x NFL | Pre-game cosmetics | Standard poker | No | Seasonal |
| DraftKings | Post-game only | Draft-based | No | Full game |
| PokerStars | Hours-long | Pure poker | No | Timeless |
| **SportsJack** | **During game** | **Poker + real-time stats** | **Yes** | **Quarters (2 min)** |

---

**Status:** Ready for investor review, partner meetings, or team presentation.

**Next checkpoint:** User validation of gameplay mockup. If positive, proceed to detailed Planning Phase (2-3 weeks).
