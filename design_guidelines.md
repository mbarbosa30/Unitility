# Paymaster Market - Design Guidelines

## Design Approach
**Reference-Based Approach**: Modern Web3 Interface
Drawing inspiration from **Uniswap's clarity + Rainbow Wallet's mobile-first design + Aave's dashboard hierarchy**

Core Principles:
- Trust through transparency: Clear fee breakdowns, instant feedback
- Scan-ability: Users need to quickly parse pool data and opportunities
- Mobile-first: 80% of transfers are mobile - touch targets, thumb zones
- Zero cognitive load: Replace technical jargon with plain language

---

## Typography

**Font Stack**: 
- Primary: **Inter** (Google Fonts) - clean, legible for data
- Monospace: **JetBrains Mono** - for addresses, token amounts

**Hierarchy**:
- Hero Headlines: text-4xl/text-5xl, font-bold
- Section Headers: text-2xl, font-semibold
- Card Titles: text-lg, font-medium
- Body Text: text-base, font-normal
- Data/Numbers: text-xl, font-semibold, tabular-nums
- Captions/Labels: text-sm, font-medium
- Token Amounts: Monospace, text-lg

---

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 8, 12, 16**
- Component padding: p-4, p-6, p-8
- Section spacing: space-y-8, space-y-12
- Card gaps: gap-4, gap-6
- Icon-text pairs: gap-2

**Grid Strategy**:
- Pool Tables: Full-width responsive tables with sticky headers
- Dashboard Cards: 1 column mobile, 2-3 columns desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Send Modal: Single column, max-w-md centered
- Sponsor Dashboard: 2-column split (stats left, actions right) on desktop

**Container Widths**:
- App Shell: max-w-7xl
- Modals/Send Flow: max-w-md
- Tables: w-full with responsive scroll

---

## Component Library

### Navigation
- **Top Bar**: Sticky header with logo, wallet connection, network indicator
- **Tab Navigation**: For Dashboard/Pools/Rebalance sections - pill-style active state
- **Mobile Nav**: Bottom tab bar (Send / Pools / Earn / More)

### Core Components

**Send Modal** (Priority: Hero Feature):
- Centered overlay, rounded-2xl, backdrop-blur
- Input fields with token selector dropdown (icon + symbol + balance)
- "Gas Paid by Pool" badge with info tooltip
- Large "Send" button, full-width
- Amount input with "Max" quick action
- Fee breakdown: "You send: 99.5 TOKEN" clearly displayed

**Pool Discovery Table**:
- Sticky header row
- Sortable columns (Fee, Volume, Discount)
- Visual indicators: Green ↓ for discounts (font-semibold, larger text), Red ↑ for premium
- Hover row highlight for desktop
- Action buttons: "Send via Pool" primary, "Details" secondary

**Pool Cards** (Mobile Alternative):
- Stacked card layout on mobile
- Token icon + symbol header
- Key metrics in grid (Fee / Volume / Discount / APY)
- CTA button at bottom

**Sponsor Dashboard**:
- Summary cards row: Total ETH, Total Fees Earned, Avg APY
- Active pools table with withdraw/adjust actions
- "Create Pool" prominent button (top-right)

**Rebalancer Panel**:
- Opportunity cards with profit calculation prominent
- One-click "Execute" button
- Expected profit vs gas cost clearly shown
- Sort by profit descending

### Data Displays
- **Stat Cards**: Large number, label below, optional trend indicator (↑ ↓)
- **Percentage Displays**: Use bold, larger text for discounts/APY
- **Token Amounts**: Monospace font, right-aligned in tables
- **Addresses**: Truncated format (0x1234...abcd), copy icon on hover

### Buttons
- Primary: Solid, rounded-lg, px-6 py-3
- Secondary: Outline style
- Tertiary: Ghost/text button for less critical actions
- Icon buttons: rounded-full, p-2 for actions

### Input Fields
- Rounded-lg borders
- Token selector with dropdown (icon + symbol)
- Amount inputs: Large text, right-aligned
- Labels above inputs, helper text below

### Badges & Tags
- Pool status: "Active" (green), "Low ETH" (yellow)
- Discount indicator: Green badge for negative percentage
- Fee tier: Subtle gray badge

### Modals & Overlays
- Backdrop blur effect
- Centered, max-w-md
- Close button (top-right X icon)
- Action buttons at bottom

---

## Visual Indicators & Micro-Interactions

**Trust Signals**:
- Checkmarks for successful states
- Loading spinners for pending transactions
- "Verified Pool" badge for high-volume pools

**Data Visualization**:
- Simple bar charts for APY comparison
- Sparklines for volume trends (optional enhancement)
- Progress bars for pool ETH balance

**Feedback**:
- Toast notifications for transaction status (top-right)
- Inline validation for input fields
- Success confetti animation on completed send (subtle)

**Animations**: Minimal, functional only
- Slide-in for modals
- Fade for tooltips
- No scroll animations, no hero animations

---

## Mobile Optimization

**Touch Targets**: Minimum 44px height for all interactive elements
**Bottom Sheet Pattern**: For token selection, pool details on mobile
**Thumb Zone**: Primary actions within bottom 1/3 of screen
**Input Types**: `type="number" inputmode="decimal"` for amounts
**Wallet Connection**: Use WalletConnect modal pattern

---

## Accessibility

- ARIA labels for all icon buttons
- Focus visible states (ring-2 ring-offset-2)
- Keyboard navigation for tables (arrow keys)
- Screen reader announcements for transaction status
- Color contrast minimum 4.5:1 for all text

---

## Icons
Use **Heroicons** (outline for default, solid for active states) via CDN

Common icons needed:
- Wallet, ArrowRight, Check, X, Info, ChartBar, Swap, Plus, Minus, Copy, ExternalLink

---

## Images
**No hero image** - this is a utility app prioritizing functionality over marketing visuals.

Only use images for:
- Token logos (via token list API or CDN)
- Wallet provider icons (MetaMask, WalletConnect)
- Empty state illustrations (subtle, minimal)