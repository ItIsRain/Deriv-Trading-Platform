# LunarGraph — Full Demo Application Build Prompt

## CONTEXT

You are building a hackathon demo application called **LunarGraph** — an AI-powered affiliate fraud ring detection system for online trading platforms. The application is a **single React app** with a tab switcher at the top that simulates a fake trading platform (Tabs 1-4) and then reveals the fraud detection intelligence platform (Tab 5). The dramatic contrast between "everything looks normal" and "the graph reveals everything" IS the product demo.

This is for the **Deriv AI Talent Sprint** hackathon (Feb 6-8, 2026). The challenge track is **Anti-Fraud + Partners & Affiliates**. Judges include Deriv's VP of Security, VP of Business Intelligence, and AI team leads from Amazon, Netflix, Apple, and JP Morgan.

**Team:** Lunar Corporation (lnr.ae)
**Product Name:** LunarGraph

---

## DESIGN SYSTEM

### UI Libraries
- **Mantine UI** — Primary component library (use `@mantine/core`, `@mantine/hooks`, `@mantine/charts`)
- **Magic UI** — For animated components, shimmer effects, particle backgrounds, animated borders, glow effects (use `magicui` components like `ShimmerButton`, `BorderBeam`, `Particles`, `NumberTicker`, `AnimatedGridPattern`)
- **Aceternity UI** — For spotlight effects, card hover effects, text generate effects, background beams, tracing beams (use components like `SpotlightCard`, `TextGenerateEffect`, `BackgroundBeams`, `TracingBeam`, `HoverBorderGradient`)

### Color Palette
**Primary brand colors across the ENTIRE app:**
- Primary Red: `#FF444F` — This is the main brand color. Used for accents, buttons, active states, highlights, important badges, the tab indicator, chart lines, and all primary interactive elements.
- White: `#FFFFFF` — Primary background for all tabs.
- Off-white: `#FAFAFA` / `#F8F9FA` — Secondary backgrounds, card fills.

**Tabs 1-4 (Fake Trading Platform):**
- Background: Pure white `#FFFFFF` and off-white `#FAFAFA`
- Primary accent: `#FF444F` (red) for all interactive elements, active states, badges, buttons, chart accents
- Secondary accent: Light red tint `#FFF0F1` for hover states, selected rows, subtle backgrounds
- Text: Dark charcoal `#1A1A1A`, medium gray `#6B7280`, light gray `#9CA3AF`
- Success (profit): `#16A34A` (green)
- Danger (loss): `#DC2626` (darker red — distinct from the brand red)
- Borders: `#E5E7EB`
- Cards: White `#FFFFFF` with subtle `#FF444F` border on hover
- Table headers: Light red tint `#FFF5F5`
- Status badges: `#FF444F` background with white text, or `#FFF0F1` background with `#FF444F` text
- The overall feel should be: premium, clean, trustworthy — like a real Deriv-style trading platform. White and red, sharp and professional.

**Tab 5 (LunarGraph Fraud Intelligence):**
- Background: Deep dark `#0A0A0F` / Dark `#111118` / `#0D0D14`
- Primary accent: `#FF444F` — Same brand red but now glowing against dark backgrounds
- Glow effects: `#FF444F` with transparency for node glows, particle trails, border beams
- Secondary accent: White `#FFFFFF` for text and emphasis against the dark background
- Severity Critical: `#FF444F` (brand red)
- Severity Warning: `#F59E0B` (amber)
- Severity Emerging: `#A855F7` (purple)
- Success: `#22C55E` (green)
- Text: `#F1F1F1`, `#D4D4D8`, `#A1A1AA`, `#71717A`
- Card/panel backgrounds: `#161620` / `#1A1A28`
- Borders: `rgba(255, 68, 79, 0.15)` (red tint) / `rgba(255, 68, 79, 0.08)` (subtle)
- This should feel like a **security operations center / cyber war room**. Dark background makes the `#FF444F` red POP dramatically. Particle effects, node glows, edge highlights all use the brand red.

### Typography
- Tabs 1-4: Clean sans-serif. Use Mantine's default or "Plus Jakarta Sans" for a premium fintech feel.
- Tab 5: System UI / monospace mix. JetBrains Mono for data. System-ui for labels.

### Design Consistency
- `#FF444F` red is the SINGLE brand color threading through the entire app — from the tab indicator in the light platform views to the glowing particles in the dark fraud detection view. This creates brand unity between the "before" and "after" experience.
- White is the canvas. In Tabs 1-4, white is the background with red accents. In Tab 5, the relationship inverts — dark is the background and both red and white become the foreground elements that pop.

---

## APPLICATION STRUCTURE

The app is a **single-page React application** with 5 tabs across the top. The tab switcher should be a clean horizontal bar using Mantine's `Tabs` component, styled with gold accent for Tabs 1-4 and purple accent for Tab 5.

### Tab Switcher Bar
- Fixed at the top of the viewport
- Left side: LunarGraph logo (a small `#FF444F` red "L" icon + "LunarGraph Demo" text)
- Center: 5 tabs labeled:
  1. "👤 Partner Dashboard"
  2. "📈 Client #1 — Buyer"
  3. "📉 Client #2 — Seller"
  4. "🔍 Compliance Monitor"
  5. "⚡ LunarGraph Intelligence"
- Right side: "Lunar Corporation" branding text
- Tabs 1-4 have white background with `#FF444F` red active indicator and text. Tab 5 has dark background with `#FF444F` red active indicator.
- When Tab 5 is selected, the ENTIRE page background transitions to dark mode. Tabs 1-4 are light mode.

---

## TAB 1: PARTNER DASHBOARD (Ahmed's View)

This simulates what a fraudulent partner sees when they log in. Everything must look completely legitimate and clean.

### Header Section
- Welcome banner: "Welcome back, Ahmed Al-Rashid" with a `#FF444F` red verified partner badge
- Partner ID: `PTR-ZH-777`
- Account Status: "Active" with green dot
- Member Since: "June 15, 2025"
- Partner Tier: "Platinum" with a `#FF444F` red badge/icon

### Stats Row (4 cards in a grid)
Use Mantine `Paper` or `Card` components with subtle `#FF444F` red border on hover, slight shadow. Each card has:

1. **Total Referrals** — Value: `24` — Small text: "+4 this month" — Icon: users icon
2. **Active Traders** — Value: `20` — Small text: "83% retention" — Icon: chart icon
3. **Monthly Commission** — Value: `$21,400` — Small text: "+12% vs last month" in green — Icon: dollar icon
4. **Total Earned** — Value: `$127,400` — Small text: "Since Jun 2025" — Icon: wallet icon

Use Magic UI `NumberTicker` for the values to animate on mount.

### Sub-Affiliates Table
Title: "My Sub-Affiliates"
Mantine `Table` with the following columns and data:

| ID | Name | Status | Referred Clients | Active Traders | This Month's Commission | Total Commission |
|----|------|--------|-----------------|----------------|------------------------|------------------|
| ZH-SUB-001 | ZH_Sub_1 | ✅ Active | 5 | 5 | $5,200 | $31,800 |
| ZH-SUB-002 | ZH_Sub_2 | ✅ Active | 5 | 5 | $5,800 | $33,200 |
| ZH-SUB-003 | ZH_Sub_3 | ✅ Active | 5 | 5 | $4,900 | $29,400 |
| ZH-SUB-004 | ZH_Sub_4 | ✅ Active | 5 | 5 | $5,500 | $33,000 |

Every row has a green "Active" badge. No red flags visible anywhere.

### Commission Chart
Use Mantine `AreaChart` or `LineChart` showing commission earnings over the past 6 months (Jul 2025 - Jan 2026). The line should show steady upward growth:
- Jul: $4,200
- Aug: $8,100
- Sep: $12,800
- Oct: $18,500
- Nov: $21,300
- Dec: $24,100
- Jan: $21,400

`#FF444F` red-colored gradient fill under the line. Clean white background.

### Footer Banner
A subtle `#FFF0F1` light red banner at the bottom: "🏆 Top 5% Partner — Keep up the great work!" with a red star icon.

**KEY DESIGN REQUIREMENT:** This entire tab must feel trustworthy and clean. A compliance officer glancing at this would see a successful, legitimate partner. Zero red flags.

---

## TAB 2: CLIENT #1 — THE BUYER

This simulates a trading client's account view. This is one of Ahmed's fake "buyer" accounts.

### Account Header
- Client ID: `CLT-Z41882`
- Name: "Rashid M. Ibrahim"
- Account Balance: `$12,400.00`
- KYC Status: "✅ Verified" (green badge)
- Risk Level: "Normal" (green badge)
- Account Age: "4 months"
- Country: "🇦🇪 UAE"

### Live Price Chart
A simulated candlestick or line chart showing EUR/USD price movement. You can use a static SVG or Mantine chart component showing a typical forex chart pattern. Display current price: `1.0847` with a green "+0.12%" change.

### Order Panel (Right Side)
Title: "Recent Trades"
Show 8-10 recent trades. ALL of them should be **BUY** orders:

| Time | Instrument | Direction | Amount | P&L |
|------|-----------|-----------|--------|-----|
| 14:32:15 | EUR/USD | 🟢 BUY | $2,000 | +$124.00 |
| 14:28:42 | GBP/USD | 🟢 BUY | $1,800 | -$67.00 |
| 13:15:08 | EUR/USD | 🟢 BUY | $2,200 | +$203.00 |
| 13:01:33 | BTC/USD | 🟢 BUY | $1,500 | +$89.00 |
| 11:45:20 | EUR/USD | 🟢 BUY | $2,000 | -$156.00 |
| 11:22:05 | GBP/USD | 🟢 BUY | $1,900 | +$78.00 |
| 10:08:17 | EUR/USD | 🟢 BUY | $2,100 | +$145.00 |
| 09:55:40 | BTC/USD | 🟢 BUY | $1,700 | -$92.00 |

P&L should be mixed — some green (profit), some red (loss). Win rate approximately 55%. This makes the account look realistic.

### Account Stats Grid
4 small cards below the chart:
1. **Total Trades:** 187
2. **Win Rate:** 54.8%
3. **Avg Trade Size:** $1,912
4. **Referred By:** ZH_Sub_1

### Account Verification Section
A small section showing:
- KYC: ✅ Verified
- Email: ✅ Verified
- Phone: ✅ Verified
- Risk Assessment: ✅ Normal
- AML Check: ✅ Passed

All green checkmarks. Everything passes.

**KEY DESIGN REQUIREMENT:** This must look like a completely normal, legitimate trading account. The judges need to feel "yeah, I wouldn't flag this either."

---

## TAB 3: CLIENT #2 — THE SELLER

**This is almost identical to Tab 2, but with critical differences that become the "aha moment" when you compare them side by side.**

### Account Header
- Client ID: `CLT-Z41883`
- Name: "Omar K. Nasser"
- Account Balance: `$11,800.00`
- KYC Status: "✅ Verified"
- Risk Level: "Normal"
- Account Age: "4 months"
- Country: "🇳🇬 Nigeria"

### Order Panel — ALL SELL ORDERS
**Same instruments, similar amounts, but ALL SELLS and timestamps are 30 seconds AFTER Client #1:**

| Time | Instrument | Direction | Amount | P&L |
|------|-----------|-----------|--------|-----|
| 14:32:45 | EUR/USD | 🔴 SELL | $2,000 | -$118.00 |
| 14:29:12 | GBP/USD | 🔴 SELL | $1,800 | +$71.00 |
| 13:15:38 | EUR/USD | 🔴 SELL | $2,200 | -$198.00 |
| 13:02:03 | BTC/USD | 🔴 SELL | $1,500 | -$85.00 |
| 11:45:50 | EUR/USD | 🔴 SELL | $2,000 | +$162.00 |
| 11:22:35 | GBP/USD | 🔴 SELL | $1,900 | -$74.00 |
| 10:08:47 | EUR/USD | 🔴 SELL | $2,100 | -$139.00 |
| 09:56:10 | BTC/USD | 🔴 SELL | $1,700 | +$96.00 |

**NOTICE:** The timestamps are exactly 30 seconds after Client #1's trades. The amounts are identical. The P&L is roughly inverse (when Client #1 profits, Client #2 loses, and vice versa). The net P&L across both accounts is approximately $0.

The win rate here is about 45% — slightly lower than Client #1 since they're taking the opposite side.

### Account Stats Grid
1. **Total Trades:** 183
2. **Win Rate:** 45.2%
3. **Avg Trade Size:** $1,887
4. **Referred By:** ZH_Sub_2

### Same Verification Section — All Green
Everything passes individually.

**KEY DESIGN REQUIREMENT:** When the presenter flips between Tab 2 and Tab 3 during the demo, the judges should have the "wait a minute..." moment. Same currencies. Same amounts. Opposite directions. 30-second gaps. But each tab looks normal on its own.

---

## TAB 4: COMPLIANCE MONITORING VIEW

This simulates what Deriv's compliance team sees — an overwhelmed alert queue where the fraud hides in plain sight.

### Header
- Title: "Transaction Monitoring — Compliance Dashboard"
- Subtitle: "Alert Queue — Week of Jan 26, 2026"
- Stats bar showing: **Total Alerts: 2,147** | **Pending Review: 1,893** | **Cleared: 241** | **Escalated: 13**

### Alert Queue Table
A large Mantine `Table` that feels overwhelming. Generate 30+ visible rows (scrollable) with a mix of alert types. The table should feel NOISY — lots of data, lots of orange/yellow "Pending" badges, hard to find anything specific.

Columns: Alert ID | Time | Client | Alert Type | Severity | Status | Action

Mix of alert types:
- "Large withdrawal" — severity Medium
- "Unusual login location" — severity Low
- "High frequency trading" — severity Medium
- "Multiple failed deposits" — severity Low
- "Rapid account funding" — severity Medium
- "Cross-border transaction" — severity Low
- "Pattern deviation" — severity Medium

**IMPORTANT:** Buried somewhere in rows 7-9, include these two alerts for Ahmed's clients:

| ALT-7284 | 14:35:00 | CLT-Z41882 | High frequency trading | Medium | 🟡 Pending | [Review] |
| ALT-7291 | 14:36:00 | CLT-Z41883 | High frequency trading | Medium | 🟡 Pending | [Review] |

These are the fraud accounts hiding in the noise. They look identical to every other medium-severity alert.

### Alert Detail Panel
When any alert is clicked (or show one pre-expanded), display a detail panel on the right side:

**Alert: ALT-7284 — CLT-Z41882**
- Client: Rashid M. Ibrahim
- Alert Type: High frequency trading
- Triggered: Jan 28, 2026, 14:35:00
- Details: "Client executed 15 trades in the last 4 hours"
- KYC Status: ✅ Verified
- Risk Score: 34/100 (Normal)
- Previous Alerts: 0
- Account Standing: Good
- **Officer Notes:** "Reviewed — active trader, no concerns. CLEARED."
- **Status: ✅ Cleared — No Action Required**

The officer reviewed it, saw nothing wrong with the individual account, and cleared it. The fraud continues.

### The "Drowning" Visualization
At the top of this tab, show a simple bar or progress indicator:
- "Officer capacity: ~80 reviews/week"
- "Current queue: 1,893 pending"
- "Estimated clearance time: 23.7 weeks"
- A red progress bar showing they'll never catch up

**KEY DESIGN REQUIREMENT:** This tab must make the judges FEEL the frustration. 2,100+ alerts, 95% are noise, and the two fraud accounts got reviewed and cleared because they looked normal individually. The system is broken.

---

## TAB 5: LUNARGRAPH FRAUD INTELLIGENCE

This is the dramatic reveal. When this tab is selected, the ENTIRE app switches to dark mode. The background transitions from white to `#0A0A0F`. The tab bar changes to dark background with `#FF444F` red accents. This visual shift should feel like entering a different world — a high-tech security operations center. The same `#FF444F` red that was a subtle accent on the white platform now becomes a GLOWING, PULSING primary color against the dark background.

### Layout: Three-Panel War Room

**Left Panel (280px width) — Sidebar:**

Section 1: "DETECTED RINGS" header in uppercase, small, with `#FF444F` red accent
3 clickable ring cards:

Ring Card 1 — "Shadow Syndicate"
- Code: RING-001
- Type: Opposite Trading Scheme
- Severity: 96 (red badge)
- Entities: 25
- Exposure: $127,400
- Status indicator: red pulsing dot

Ring Card 2 — "Ghost Network"
- Code: RING-002
- Type: Commission Farm
- Severity: 83 (amber badge)
- Entities: 37
- Exposure: $43,200

Ring Card 3 — "The Sleeper"
- Code: RING-003
- Type: Behavioral Drift
- Severity: 62 (purple badge)
- Entities: 11
- Exposure: $8,100 (est.)

Section 2: "PLATFORM STATS"
- Total Entities: (total from data)
- Fraud Entities: 73
- Total Exposure: $178,700
- Alert Reduction: 99.86%

Section 3: Bottom — "Run Full Graph Scan" button
- Use Magic UI `ShimmerButton` or Aceternity `HoverBorderGradient` — styled with `#FF444F` red
- When clicked, run a cinematic scan animation:
  Step-by-step terminal output:
  ```
  ▶ Ingesting entity data...
  ✓ Building knowledge graph...
  ✓ Running community detection...
  ✓ Analyzing trade correlations...
  ✓ Computing behavioral baselines...
  ✓ Detecting IP/device overlaps...
  ✓ Identifying mirror trade pairs...
  ✓ Scoring fraud probability...
  ✓ Generating case reports...
  ✓ Scan complete — 3 fraud rings detected
  ```
  Each step appears with a 500-600ms delay. A progress bar fills beneath. When complete, show a green success badge: "✓ 3 Fraud Rings Detected · 73 entities · $178,700 exposure"

**Center Panel (flex: 1) — Main Content Area:**

This has 3 sub-views toggled by small buttons at the top of the panel: "⚡ Command" | "🔍 Investigate" | "🤖 Copilot"

**Sub-view: ⚡ Command (Default)**
A full-screen interactive force-directed graph visualization rendered on an HTML5 Canvas.

The graph must have:
- **Physics simulation:** Nodes repel each other. Connected nodes attract. Nodes drift and settle organically. The graph "breathes."
- **Node types with different sizes:**
  - Partner nodes: largest (radius 16-20px), labeled
  - Affiliate nodes: medium (radius 10-14px), labeled
  - Client nodes: smallest (radius 5-8px), no label unless hovered
- **Color coding:**
  - Selected fraud ring nodes glow in the ring's color (red for Ring 1, amber for Ring 2, purple for Ring 3)
  - Non-fraud nodes: dim gray `#1E293B`, nearly invisible
  - Fraud nodes from other rings: medium gray `#4B5563`
- **Edge rendering:**
  - Fraud ring edges: colored with ring color at 30-40% opacity, line width 2px
  - Non-fraud edges: very faint gray at 8% opacity, line width 0.5px
- **Animated particles:**
  - Small glowing dots (3-4px) that travel along fraud ring edges
  - Each particle has the ring's color with a radial glow effect
  - Particles spawn periodically on random fraud edges and travel from source to target
  - Speed: variable (0.008-0.02 progress per frame)
  - This creates a "data flowing through the network" effect
- **Node interaction:**
  - Hover shows tooltip with: name, type, country, IP address, device ID, and fraud ring badge if applicable
  - Clicking a ring in the sidebar re-colors the graph to highlight that ring
- **Background:** Subtle grid pattern (lines at 40px intervals, very faint `#FF444F` red at 4% opacity)
- **Stats overlay:** Small semi-transparent box in top-left showing node count, edge count, fraud entity count, particle count

**Bottom overlay on Command view:**
When a ring is selected, show an info bar at the bottom of the graph area:
- Ring code, name, status badge (colored), severity score (large number)
- 4 mini stats: Type, Entities, Exposure, Recommended Actions count

**Sub-view: 🔍 Investigate**
Split into two columns:

Left column — "INVESTIGATION TIMELINE"
A vertical timeline (use Aceternity `TracingBeam` or custom) showing the chronological history of the selected fraud ring. Each event is a node on the timeline:

For Ring 001 (Shadow Syndicate):
- Jun 15, 2025 — Zenith_Holdings registered as partner (no flag)
- Jul 02, 2025 — First 2 sub-affiliates created (no flag)
- Aug 18, 2025 — Client referrals begin — normal pattern (no flag)
- Nov 03, 2025 — Sub-affiliates 3 & 4 added (no flag)
- Dec 12, 2025 — ⚠ First mirror trade pair detected (EUR/USD) (flagged, yellow)
- Jan 05, 2026 — ⚠ Trade timing correlation exceeds 80% (flagged, orange)
- Jan 15, 2026 — 🔴 Full ring activation — 15+ mirror pairs/day (flagged, red)
- Jan 28, 2026 — 🔴 $127,400 in commissions extracted (flagged, red)

Unflagged events have dark gray dots. Flagged events have colored dots with glow. The transition from gray to yellow to red tells the story visually.

Right column — "EVIDENCE CHAIN"
Cards for each piece of evidence with confidence bars:

Evidence Card 1:
- Type badge: "NETWORK" (`#FF444F` red)
- Detail: "1 partner → 4 sub-affiliates → 20 client accounts"
- Confidence: 98% (green bar)

Evidence Card 2:
- Type badge: "TRADING" (`#FF444F` red)
- Detail: "15+ opposite trade pairs per day across EUR/USD, GBP/USD, BTC/USD"
- Confidence: 96%

Evidence Card 3:
- Type badge: "TIMING" (amber)
- Detail: "Trade execution within 30-second windows, 94% timing correlation"
- Confidence: 94%

Evidence Card 4:
- Type badge: "IDENTITY" (white on dark)
- Detail: "All entities share IP range 192.168.50.x (5 IPs, 25 accounts)"
- Confidence: 99%

Evidence Card 5:
- Type badge: "DEVICE" (`#FF444F` red)
- Detail: "3 physical devices operating 25 accounts across 4 affiliates"
- Confidence: 97%

Evidence Card 6:
- Type badge: "FINANCIAL" (`#FF444F` red)
- Detail: "Net P&L across ring ≈ $0, commission extraction: $127,400"
- Confidence: 95%

Each card has a thin colored progress bar showing the confidence percentage.

Below evidence: "RECOMMENDED ACTIONS" section with numbered steps:
1. Suspend Zenith_Holdings immediately
2. Freeze all commission payouts ($127,400)
3. Place 20 client accounts on withdrawal hold
4. Refer to Legal for commission clawback
5. Block IP range 192.168.50.x platform-wide

**Sub-view: 🤖 Copilot**
A chat interface for natural language fraud investigation.

Top bar: green dot + "Investigation Copilot" + "Natural language fraud investigation"

Chat area (scrollable):
- AI messages: dark background cards, `#FF444F` red "LUNARGRAPH AI" label, monospace-friendly text
- User messages: red-tinted cards (`rgba(255, 68, 79, 0.1)` background), right-aligned
- Typing indicator: "Analyzing graph intelligence..." with blinking dots

Input area at bottom:
- Text input with placeholder: "Investigate a fraud ring..."
- Send button with `#FF444F` red background, white text
- Quick action buttons above input: "Show all rings", "Investigate Shadow Syndicate", "Ghost Network details", "Predict The Sleeper" — outlined in `rgba(255, 68, 79, 0.2)`

Pre-built responses (match input keywords to responses):

If input contains "001", "shadow", "mirror", or "opposite" → Return full Ring 001 case report with network topology ASCII tree, scheme explanation, why traditional systems miss it, and recommended actions.

If input contains "002", "ghost", "commission", or "farm" → Return Ring 002 analysis.

If input contains "003", "sleeper", "apex", "predict", or "escalat" → Return Ring 003 predictive analysis with behavioral trajectory.

If input contains "all", "summary", or "overview" → Return summary table of all 3 rings with totals.

Default → Return help text with suggested queries.

**Right Panel (320px width) — Live Alert Feed:**

Header: Red pulsing dot + "Live Feed" + event count

Auto-scrolling feed of simulated real-time events. New alert appears every 3-6 seconds. Each alert is a small card with:
- Severity icon (🔴 critical / 🟠 high / 🟡 medium / 🔵 info)
- Alert text
- Timestamp
- Newest alerts are brightest, older ones fade in opacity

Alert templates (randomly cycled):
- 🔴 "Mirror trade detected: EUR/USD — $2,000 BUY/SELL within 30s window"
- 🔴 "Shared device fingerprint across 5 accounts in Ring-001"
- 🟠 "Commission anomaly: ND_Agent_2 payout 340% above baseline"
- 🟠 "Rapid withdrawal pattern: 4 Ghost Network accounts withdrew within 2h"
- 🟡 "Behavioral drift: Apex_Trading_Co correlation now at 82%"
- 🟡 "IP diversity alert: ATC_Ref_1 down to 3 unique IPs"
- 🔵 "Graph updated: 27 new edges, 5 new nodes processed"
- 🔵 "Community detection pass complete — no new clusters found"

---

## DATA GENERATION

Generate all data in-memory on app mount. No backend needed.

### Entities to Generate:
- **25 legitimate partners**, each with 2-4 sub-affiliates, each affiliate with 3-6 clients
- **Fraud Ring 1 (Shadow Syndicate):** 1 partner (Zenith_Holdings) → 4 affiliates → 20 clients. All share IP range 192.168.50.x and 3 device fingerprints.
- **Fraud Ring 2 (Ghost Network):** 1 partner (Nova_Digital) → 6 affiliates → 30 clients. All from single IP 10.20.30.40. 5 device fingerprints.
- **Fraud Ring 3 (The Sleeper):** 1 partner (Apex_Trading_Co) → 2 affiliates → 8 clients. IP range 172.16.0.x.

### Trade Data:
- Legitimate clients: 3-10 random trades each, random instruments, random direction, random amounts ($50-$5000)
- Ring 1 clients: Mirror trade pairs — same instrument, same amount (±$100), opposite direction, 30-second timestamp gaps
- Ring 2 clients: Exactly 2 trades per client (minimum for commission), small amounts ($10-$50)
- Ring 3 clients: 5 trades each, showing increasing timing correlation

### Graph Data:
- Nodes: all partners, affiliates, clients with position coordinates
- Edges: partner→affiliate (referral), affiliate→client (referral)
- Each node has: id, name, type, country, IP, device fingerprint, fraud flag, ring number

---

## ANIMATION AND EFFECTS

### Tab Transitions
- Smooth crossfade between tabs
- When switching to Tab 5, the background color transitions from white to `#0A0A0F` over 300ms
- The tab bar styling also transitions (white background with red accents → dark background with glowing red accents)

### Force Graph (Tab 5 Command View)
- Use HTML5 Canvas for performance
- Physics: repulsion between all nodes, attraction on edges, center gravity, damping at 0.92
- Render at 60fps
- Particle system on fraud edges
- Glow effects using radial gradients

### Scan Animation (Tab 5)
- 10 steps, each taking 500-600ms
- Terminal-style monospace text
- Each completed step gets a green checkmark
- Progress bar fills incrementally
- Final state: green success box

### Alert Feed (Tab 5)
- New alerts slide in from top with fade-in
- Older alerts decrease in opacity
- Maximum 30 visible alerts, oldest removed

### Number Animations
- All stat numbers should animate on mount (count up from 0)
- Use Magic UI NumberTicker or custom counter

---

## RESPONSIVE REQUIREMENTS

- Primary target: 1920x1080 (demo will be on a large screen / projector)
- Tab 5 three-panel layout: fixed sidebar widths (280px left, 320px right), flexible center
- Tabs 1-4: max-width 1200px, centered, clean spacing
- Scrollable areas where content overflows

---

## TECH STACK

- **React 18+** with hooks (useState, useEffect, useRef, useCallback, useMemo)
- **Mantine UI v7** (`@mantine/core`, `@mantine/hooks`, `@mantine/charts`)
- **Magic UI** components where appropriate
- **Aceternity UI** components where appropriate
- **Tailwind CSS** for utility classes alongside Mantine
- **Recharts** or **Mantine Charts** for the commission chart
- **HTML5 Canvas** for the force-directed graph
- **No backend** — all data generated client-side

---

## CRITICAL REQUIREMENTS

1. **Everything must work as a single React application** — no separate pages, no routing needed, just tab switching
2. **The contrast between Tabs 1-4 (light/gold) and Tab 5 (dark/purple) is the core of the demo** — make it dramatic
3. **Tab 5 must feel alive** — particles moving, alerts scrolling, graph breathing, glows pulsing
4. **Tabs 1-4 must feel trustworthy** — clean, professional, no red flags visible
5. **The data must be consistent across tabs** — Client #1's trades in Tab 2 must match the trades mentioned in Tab 5's investigation
6. **Performance matters** — Canvas graph must run at 60fps with 200+ nodes
7. **The scan animation in Tab 5 is the demo's opening moment** — make it cinematic
8. **Every fake account must pass every visible check** (KYC verified, risk normal, AML passed) — this proves the fraud is invisible at the individual level
9. **The Mirror trade timing is the key evidence** — Tab 2 shows BUY at 14:32:15, Tab 3 shows SELL at 14:32:45. Same instrument, same amount, 30 seconds apart. This is what the judges need to see.
10. **Brand it as "LunarGraph by Lunar Corporation"** throughout

---

## DEMO FLOW REMINDER

The presenter will:
1. Open Tab 1 → "Meet Ahmed, a top-performing partner"
2. Open Tab 2 → "Here's one of his traders. Looks normal."
3. Open Tab 3 → "Here's another. Also normal. But compare the timestamps..."
4. Open Tab 4 → "2,100 alerts. The compliance team reviewed Ahmed's clients and cleared them."
5. Open Tab 5 → Hit "Run Scan" → Graph reveals the fraud ring → "Now see what happens when you look at the CONNECTIONS."

The app must support this flow seamlessly.
