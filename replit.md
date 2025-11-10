# Paymaster Market

## Overview

Paymaster Market is a Web3 application that enables gasless token transfers using ERC-4337 Account Abstraction. The platform operates as a decentralized marketplace where sponsors deposit ETH into pools for specific tokens, allowing users to send those tokens without needing ETH for gas fees. Users pay a small percentage fee in the token they're sending, while sponsors earn yield in tokens they believe in, and rebalancers can profit from arbitrage opportunities when price discounts emerge.

The application follows a "Venmo-like" user experience philosophy: send any token as easily as sending a text message, with zero friction and zero cognitive load.

## Recent Changes

### November 10, 2025 - Gas Limit and UX Fixes
- **Fixed AA33 Out-Of-Gas errors**: Tripled gas limits for paymaster validation
  - callGasLimit: 50K → 150K (deployed accounts), 200K → 300K (undeployed)
  - verificationGasLimit: 100K → 300K (deployed accounts), 500K unchanged (undeployed)
  - preVerificationGas: 21K → 50K (deployed accounts), 100K unchanged (undeployed)
  - Reason: PaymasterPool validation does extensive work (decode callData, check balances/allowances)
- **Fixed pool creation form**: Reset form state when modal opens to prevent stale fee/minimum values
- **Fixed token selection UX**: Deduplicate tokens in dropdown - show each token once instead of per-pool
- **Direct EntryPoint deposits**: Bypass pool.deposit() and call EntryPoint.depositTo() directly for guaranteed deposits
- **Pool parameters verified**: TALENT pool (0x072330...) correctly configured with 3% fee, 5 TALENT minimum

### November 10, 2025 - ERC-4337 v0.6 EntryPoint Migration
- **Updated to v0.6 EntryPoint**: Changed from v0.7 (0x0000000071727De22E5E9d8BAf0edAc6f37da032) to v0.6 (0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
- **Converted UserOp format**: Changed from v0.7 packed format to v0.6 unpacked format for bundler compatibility
  - Unpacked gas limits: `callGasLimit`, `verificationGasLimit` instead of packed `accountGasLimits`
  - Unpacked gas fees: `maxFeePerGas`, `maxPriorityFeePerGas` instead of packed `gasFees`
  - Simplified `paymasterAndData`: Just paymaster address instead of embedded gas limits
- **Reason**: Existing SimpleAccount (0xe7C0dad97500ccD89fF9361DC5acB20013873bb0) was deployed with v0.6 EntryPoint
- **Bundler compatibility**: Pimlico bundler expects v0.6 format for the configured EntryPoint

### November 10, 2025 - PaymasterPool Redeployment
- **Fixed TALENT token address mismatch**: Previous deployment used incorrect token address
- **Deployed new PaymasterPool**: 0xa7c6359200fa376c233a454de456291357d5ed18
  - Correct TALENT token: 0x9a33406165f562e16c3abd82fd1185482e01b49a
  - Fee: 0.5% (50 basis points)
  - Minimum transfer: 1 TALENT token
  - Deployment TX: 0x84ea6f8b9cce6000460df5476cea23858fd1801bbb232afaebc96ae622c25728
- **Funded with 0.001 ETH**: TX 0x3bfdcaa397c9a9964082b4ee5b265748e13023ebe7eb88ef4691849fa45756ce
- **Database updated**: Pool contract_address updated to new deployment
- **Event indexer**: Automatically tracking new contract for deposits, withdrawals, and fee claims

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
- RainbowKit + Wagmi for Web3 wallet connection (Base mainnet)
- Viem for Ethereum interactions and contract calls

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
- Viem public client for blockchain event indexing on Base mainnet

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
- `pools` table: Tracks gas sponsorship pools with token info, ETH deposits, fees, volume, discount, APY, gas price metrics, and blockchain metadata (contractAddress, tokenAddress, sponsor, chainId, blockNumber, transactionHash)
- `transactions` table: Records token transfers with from/to addresses, amounts, fees, pool references, and blockchain metadata (tokenSymbol, blockNumber, chainId, transactionHash)
- UUID primary keys with server-generated defaults
- Decimal precision for financial data (18 decimals for amounts, proper precision for percentages)
- Timestamps for audit trails
- Blockchain fields enable event indexing and verification

**Data Layer Pattern:**
- Storage abstraction layer (`IStorage` interface) for testability
- `DatabaseStorage` implementation using Drizzle ORM
- Direct database queries without additional caching layer
- Delete methods (`deletePool`, `deleteTransaction`) for chain reorganization rollback
- Seed data for development with mock pools (DOGGO, USDC, RARE) including Base mainnet metadata
- Indexed query methods: `getPoolByContractAddress()`, `getPoolByTransactionHash()`, `getTransactionsByPoolId()`, `getTransactionByHash()` for O(1) or O(log n) lookups

**Database Performance:**
- 8 B-tree indexes for efficient querying:
  - Pools: contractAddress, transactionHash, blockNumber, createdAt
  - Transactions: poolId, transactionHash, blockNumber, timestamp
- Address normalization: All addresses stored in lowercase for consistent equality matching
- Indexer uses targeted queries instead of full table scans (14 optimizations across event handlers)
- Reorg handling optimized with indexed lookups (pool deletion, balance recalculation)

### Blockchain Integration

**Smart Contracts (Base Mainnet):**
- PaymasterFactory: Deploys new PaymasterPool instances for specific tokens
- PaymasterPool: Manages ETH deposits, fee collection, and paymaster validation logic
- SimpleAccountFactory: Creates smart contract wallets for users (deployed at 0x9406Cc6185a346906296840746125a0E44976454)
- SimpleAccount: ERC-4337 v0.7 smart account with executeBatch support
- ABIs extracted from Solidity and stored in `client/src/contracts/` directory
- Deployment scripts in `scripts/` directory with proper event signatures
- Contract helpers in `client/src/lib/contracts.ts` with address validation guards

**Gasless Transfer Architecture (EOA-based):**
- **User Tokens Stay in EOA:** Tokens remain in user's externally owned account (MetaMask, etc.)
- **Smart Account Proxy:** Each user has a SimpleAccount (ERC-4337) that acts on their behalf
- **One-Time Approval:** User approves SimpleAccount to spend tokens (like approving Uniswap)
- **Gasless Execution Flow:**
  1. User signs UserOperation off-chain (free)
  2. Bundler (Pimlico) executes UserOp on user's smart account
  3. Smart account calls `executeBatch([token, token], [transferFrom(eoa→recipient, amount), transferFrom(eoa→paymaster, fee)])`
  4. Paymaster validates: correct EOA, sufficient balance/allowance, proper fee calculation
  5. Paymaster sponsors gas in ETH, collects fee in tokens
  6. Transaction succeeds - recipient gets tokens, paymaster gets fee, user pays no gas
- **Counterfactual Deployment:** Smart accounts deployed on first use via initCode (bundler handles deployment)
- **Security:** PaymasterPool validates executeBatch selector, transferFrom selectors, token addresses, EOA ownership, balance, allowance, and fee calculation

**Event Indexer:**
- Real-time blockchain event listener using Viem's `watchContractEvent`
- Monitors PaymasterFactory for PoolCreated events (0x33363435...)
- Monitors PaymasterPool instances for Deposited, Withdrawn, and FeesClaimed events
- Syncs events to database with full blockchain metadata (blockNumber, chainId, transactionHash)
- Chain reorganization handling: deletes affected records and recalculates aggregates with bigint precision
- Watcher lifecycle management: separate factory watcher and pool watchers to prevent leaks
- Bigint math throughout (parseEther/formatEther) to avoid floating-point precision errors
- Indexer starts automatically on server launch if VITE_PAYMASTER_FACTORY_ADDRESS is set

**Wallet Connection:**
- RainbowKit integration for one-click wallet connection
- Configured for Base mainnet (chainId 8453)
- ConnectButton in app header with address display and network switcher
- Wagmi hooks for reading contract state and sending transactions
- Viem for low-level contract interactions and event parsing

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

**Accessibility Features:**
- All icon-only buttons have accessible labels (aria-label or sr-only text)
  - Theme toggle: Dynamic aria-label based on current state
  - Carousel navigation: sr-only text for Previous/Next slides
  - Sidebar trigger: sr-only text for Toggle Sidebar
- Focus-visible states on all interactive elements (buttons, inputs, selects)
  - Buttons: focus-visible:ring-1 with theme-aware ring color
  - Inputs/selects: focus-visible:ring-2 with ring offset
- Keyboard navigation fully supported
  - ESC closes all Dialog/Modal components (Radix UI primitive)
  - Tab/Shift+Tab navigate through interactive elements
  - Arrow keys work in Select dropdowns (Radix UI primitive)
  - Focus trap within modals with proper focus return