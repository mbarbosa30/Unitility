# Paymaster Market

## Overview

Paymaster Market is a Web3 application that enables gasless token transfers using ERC-4337 Account Abstraction. The platform operates as a decentralized marketplace where sponsors deposit ETH into pools for specific tokens, allowing users to send those tokens without needing ETH for gas fees. Users pay a small percentage fee in the token they're sending, while sponsors earn yield in tokens they believe in, and rebalancers can profit from arbitrage opportunities when price discounts emerge.

The application follows a "Venmo-like" user experience philosophy: send any token as easily as sending a text message, with zero friction and zero cognitive load.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight React Router alternative)
- TanStack Query (React Query) for server state management and API caching
- Tailwind CSS for styling with shadcn/ui component library

**Design Philosophy:**
- Mobile-first approach (80% of transfers are mobile)
- Reference-based design inspired by Uniswap's clarity, Rainbow Wallet's mobile design, and Aave's dashboard hierarchy
- Typography: Inter font family for UI, JetBrains Mono for addresses and token amounts
- Zero cognitive load: plain language over technical jargon
- Scan-ability: quick parsing of pool data and opportunities

**Semantic Color System (WCAG AA Compliant):**
- Success (green) for positive states: discounts, profits, active pools
  - Light mode: hsl(142, 71%, 28%) + white text (5.3:1 contrast)
  - Dark mode: hsl(142, 70%, 50%) + dark green text (8.7:1 contrast)
- Warning (orange) for attention states: low ETH alerts, caution indicators
  - Light mode: hsl(38, 92%, 30%) + white text (5.4:1 contrast)
  - Dark mode: hsl(38, 92%, 60%) + dark brown text (7.6:1 contrast)
- All semantic colors registered in Tailwind config with border/foreground variants
- Badge component provides success/warning/destructive variants (no manual hover overrides)

**Component Structure:**
- Modular component architecture with separation between UI primitives (`/components/ui`) and feature components
- Landing page with value proposition, how-it-works, and CTA sections
- Main app with tabbed interface for Pools, Sponsor Dashboard, and Rebalancer Panel
- Modal-based flows for token sending and token acquisition
- Reusable components: TokenIcon, DiscountBadge, StatCard

**State Management:**
- React Query for API data fetching and caching with infinite stale time
- Local React state for UI interactions and form inputs
- No global state management library (Redux/Zustand) - relies on React Query cache
- 401 errors throw by default (authenticated endpoints)

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- RESTful API design pattern
- Drizzle ORM for database operations
- Session-based architecture (connect-pg-simple for session storage)

**API Design:**
- RESTful endpoints following resource-based patterns
- `/api/pools` - GET all pools, POST create pool
- `/api/pools/:id` - GET single pool, PATCH update pool
- `/api/transactions` - Transaction operations
- PATCH supports atomic increments for volume and fees to prevent race conditions
- JSON request/response format with proper error handling

**Server Configuration:**
- Custom request logging middleware for API endpoints
- Request body parsing with raw body preservation for webhook validation
- CORS and security headers configured for production
- Development mode includes Vite middleware integration and HMR support

### Data Storage

**Database:**
- PostgreSQL via Neon serverless driver
- Drizzle ORM with type-safe schema definitions
- Schema-first approach with Zod validation

**Schema Design:**
- `pools` table: Tracks gas sponsorship pools with token info, ETH deposits, fees, volume, discount, APY, and gas price metrics
- `transactions` table: Records token transfers with from/to addresses, amounts, fees, and pool references
- UUID primary keys with server-generated defaults
- Decimal precision for financial data (18 decimals for amounts, proper precision for percentages)
- Timestamps for audit trails

**Data Layer Pattern:**
- Storage abstraction layer (`IStorage` interface) for testability
- `DatabaseStorage` implementation using Drizzle ORM
- Direct database queries without additional caching layer
- Seed data for development with mock pools (DOGGO, USDC, RARE)

### External Dependencies

**UI Component Library:**
- Radix UI primitives for accessible, unstyled components (dialogs, dropdowns, tooltips, etc.)
- Custom themed with Tailwind CSS via shadcn/ui configuration
- Class Variance Authority (CVA) for component variant management

**Database & ORM:**
- Neon serverless PostgreSQL for production database hosting
- Drizzle Kit for schema migrations and database management
- Connect-pg-simple for PostgreSQL-backed session storage

**Development Tools:**
- Replit-specific plugins for development environment integration
- Vite plugins for runtime error overlay, cartographer, and dev banner in Replit environment
- ESBuild for server-side production builds

**Fonts:**
- Google Fonts (Inter and JetBrains Mono) loaded via CDN
- Self-hosted fallback to system fonts

**Build & Deployment:**
- Environment-based configuration (NODE_ENV)
- Separate build outputs: client to `dist/public`, server to `dist`
- Path aliases for clean imports (`@/`, `@shared/`, `@assets/`)

**Quality Assurance:**
- TypeScript strict mode for type safety
- Test IDs embedded in components for E2E testing support
- Incremental TypeScript compilation with build info caching