# Paymaster Market

## Overview

Paymaster Market is a Web3 application leveraging ERC-4337 Account Abstraction to facilitate gasless token transfers. It functions as a decentralized marketplace where sponsors deposit ETH into token-specific pools, enabling users to send those tokens without paying gas fees. Users pay a small percentage fee in the token being sent, sponsors earn yield from their deposited tokens, and rebalancers can profit from arbitrage opportunities. The platform aims to provide a "Venmo-like" user experience for sending any token with zero friction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS (with shadcn/ui), RainbowKit, Wagmi, Viem.

**Design Philosophy:** Mobile-first, inspired by Uniswap, Rainbow Wallet, and Aave. Emphasizes Inter and JetBrains Mono typography, zero cognitive load, and scan-ability. Uses a WCAG AA Compliant semantic color system.

**Component Structure:** Modular architecture with UI primitives and feature components. Includes a landing page, a tabbed main app (Pools, Sponsor Dashboard, Rebalancer Panel), and modal-based flows.

**State Management:** TanStack Query for API data fetching and caching; local React state for UI interactions. No global state management library.

### Backend Architecture

**Technology Stack:** Express.js with TypeScript, RESTful API, Drizzle ORM, session-based architecture (connect-pg-simple), Viem for blockchain event indexing.

**API Design:** RESTful endpoints for pools and transactions, supporting atomic operations and JSON format.

**Server Configuration:** Custom request logging, webhook validation, CORS, and security headers.

### Data Storage

**Database:** PostgreSQL (Neon serverless driver) with Drizzle ORM and Zod validation.

**Schema Design:** Tables for `pools` (tracking gas sponsorship pools, token info, deposits, fees, volume, etc.) and `transactions` (recording token transfers). Uses UUID primary keys, decimal precision for financial data, and timestamps.

**Data Layer Pattern:** Storage abstraction layer (`IStorage` interface) with `DatabaseStorage` using Drizzle ORM. Optimized with 8 B-tree indexes for efficient querying and supports chain reorganization rollback.

### Blockchain Integration

**Smart Contracts (Base Mainnet):** PaymasterFactory (deploys PaymasterPools), PaymasterPool (manages deposits, fees, validation), SimpleAccountFactory, and SimpleAccount (ERC-4337 v0.7 smart account). ABIs are extracted and stored locally.

**Gasless Transfer Architecture:** Tokens remain in user's EOA. A SimpleAccount acts as a proxy, requiring a one-time approval. Gasless execution involves the user signing a UserOperation, a Bundler (Pimlico) executing it, the smart account calling `executeBatch` for token transfer and fee collection, and the Paymaster sponsoring gas after validation. Smart accounts are counterfactually deployed.

**Event Indexer:** Real-time listener using Viem to monitor `PoolCreated`, `Deposited`, `Withdrawn`, and `FeesClaimed` events. Syncs events to the database, handles chain reorganizations, and uses bigint math for precision.

**Wallet Connection:** RainbowKit for one-click wallet connection on Base mainnet, using Wagmi hooks and Viem for interactions.

## External Dependencies

**UI Component Library:** Radix UI primitives, themed with Tailwind CSS via shadcn/ui, using Class Variance Authority (CVA).

**Database & ORM:** Neon serverless PostgreSQL, Drizzle Kit for migrations, Connect-pg-simple for session storage.

**Development Tools:** Replit-specific plugins, Vite plugins, ESBuild.

**Fonts:** Google Fonts (Inter and JetBrains Mono) via CDN.

**Build & Deployment:** Environment-based configuration, separate build outputs for client and server, path aliases.

**Quality Assurance:** TypeScript strict mode, test IDs for E2E testing, incremental TypeScript compilation.

**Accessibility Features:** Accessible labels for buttons, focus-visible states, keyboard navigation support (ESC, Tab/Shift+Tab, Arrow keys), and focus trap within modals.