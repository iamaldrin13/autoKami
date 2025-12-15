# GEMINI.md - Kami Automation System

## 🎯 PROJECT STATUS (Updated: 2025-12-15)

### ✅ COMPLETED FEATURES

#### 1. Database Layer (Supabase PostgreSQL) - COMPLETE
- ✅ Full schema implementation (`supabase/schema.sql`)
- ✅ Users table with Privy authentication
- ✅ Operator wallets for multi-wallet teams
- ✅ Kamigotchis table with comprehensive Kami data
- ✅ Kami profiles for automation settings
- ✅ Harvest logs for operation tracking
- ✅ **System logs table** (as required by GEMINI.md core principles)
- ✅ User settings for preferences
- ✅ Row Level Security (RLS) policies
- ✅ Helper functions for queries
- ✅ Indexes for performance optimization

#### 2. Backend API Server - COMPLETE
**Location**: `app/src/`
- ✅ Express.js server with TypeScript
- ✅ **Services Layer**:
  - `automationService.ts` - Harvest & crafting automation loop (60s interval)
  - `harvestService.ts` - Start/stop/collect harvest operations
  - `craftingService.ts` - Recipe crafting with blockchain integration
  - `kamiService.ts` - Kami data retrieval from blockchain
  - `accountService.ts` - Account management
  - `skillService.ts` - Skill tree management
  - `supabaseService.ts` - Database operations with encryption
  - `telegram.ts` - Telegram notification integration
  - `transactionService.ts` - Blockchain transaction handling
  - `watchlistService.ts` - **NEW** Watchlist management & distance calculation
- ✅ **API Routes**:
  - `accountRoutes.ts`, `farmingRoutes.ts`, `harvestRoutes.ts`
  - `kamigotchiRoutes.ts`, `kamiRoutes.ts`, `profileRoutes.ts`
  - `systemRoutes.ts`, `transactionRoutes.ts`
  - `watchlistRoutes.ts` - **NEW** Watchlist endpoints

#### 3. Automation System - FULLY OPERATIONAL
**Location**: `app/src/services/automationService.ts`

**Harvest Automation**:
- ✅ Auto-start harvesting after rest duration expires
- ✅ Auto-stop harvesting after harvest duration expires
- ✅ **Health-based emergency stop** (configurable threshold)
- ✅ **State synchronization** with on-chain Kami status
- ✅ Comprehensive logging to console AND database
- ✅ Error handling with retry logic

**Crafting Automation**:
- ✅ Auto-craft recipes on configurable intervals
- ✅ **Stamina checking** before crafting (prevents failed txs)
- ✅ Retry logic (3 attempts with 60s delays)
- ✅ Per-wallet crafting settings
- ✅ Success/failure logging to system_logs

**Automation Features**:
- ✅ 60-second polling interval
- ✅ Per-Kami automation profiles
- ✅ Configurable harvest/rest durations
- ✅ Health threshold monitoring
- ✅ State mismatch correction
- ✅ Real-time status tracking

#### 4. Frontend Application - COMPLETE
**Location**: `app/frontend/src/`
- ✅ React + TypeScript + Vite
- ✅ **Privy authentication** integration
- ✅ CharacterManagerPWA component (main UI)
- ✅ **Multi-theme support** (arcade, pastel, dark, frosted)
- ✅ Automation controls UI
- ✅ Kami management interface
- ✅ System logs viewer (API integration ready)
- ✅ Real-time updates via Supabase subscriptions
- ✅ Responsive PWA design
- ✅ **Watchlist Revamp**:
  - ✅ Account-based tracking (for performance)
  - ✅ Collapsible UI with distance & status indicators
  - ✅ "Harvesting" (Green) vs "Resting" (Orange) visual cues

#### 5. Comprehensive Logging - IMPLEMENTED
**Follows GEMINI.md standards**:
- ✅ Console logging with `[Category] Message` format
- ✅ Database logging to `system_logs` table
- ✅ All operations logged:
  - `[Automation]` - Automation loop events
  - `[Harvest]` - Start/stop/collect operations
  - `[Crafting]` - Auto-craft events
  - `[Transaction]` - Blockchain transactions
  - `[Error]` - Error details with context
  - `[Success]` - Success confirmations
- ✅ Logs include: user_id, kami_index, action, status, message, metadata
- ✅ Frontend-accessible via API endpoints

#### 6. Deployment Infrastructure - COMPLETE
**Location**: `app/docker-compose.yml`
- ✅ Docker containerization
- ✅ **Tailscale** integration for secure networking
- ✅ Production-ready configuration
- ✅ Auto-restart policies
- ✅ Environment variable management

#### 7. Blockchain Integration - COMPLETE
- ✅ Ethers.js v6 integration
- ✅ Yominet RPC connection
- ✅ GetterSystem for reading Kami state
- ✅ HarvestStartSystem, HarvestStopSystem integration
- ✅ CraftSystem integration
- ✅ Private key encryption/decryption (AES-256-GCM)
- ✅ Transaction error handling

#### 8. Telegram Notifications - COMPLETE
**Location**: `app/src/services/telegram.ts`
- ✅ Telegram Bot API integration
- ✅ Notification sending functionality
- ✅ Test message endpoint
- ✅ User settings for chat ID configuration
- ✅ Error notifications for automation failures

#### 9. Harvest and Feed Strategy - BACKEND COMPLETE
- ✅ Database migration created (`20251211_add_feed_strategy.sql`)
- ✅ `feedService.ts` implemented with `walletMutex`
- ✅ `automationService.ts` updated to handle `harvest_feed` strategy
- ✅ Test script created (`test-feed-kami.ts`)
- ⚠️ Frontend UI pending

### 🔄 PARTIALLY COMPLETE / NEEDS VERIFICATION

#### 1. Supabase Edge Functions
- ⚠️ Timer-processor cron function not found in `/supabase/functions/`
- ⚠️ Replaced by in-app automation loop (fully operational)

#### 2. Frontend System Logs Viewer
- ✅ System logs visible in UI (bottom panel)
- ⚠️ Real-time streaming via polling (could be enhanced with Supabase subscriptions)

### ❌ NOT IMPLEMENTED (from original GEMINI.md spec)

#### 1. Timer-based System (Original Design)
**Original spec called for**:
- `harvest_timers` table with expires_at
- `rest_timers` table with expires_at
- Edge function cron job to process timers

**Current implementation uses**:
- Polling-based automation loop (60s interval)
- `last_harvest_start` and `last_collect` timestamps
- Duration-based triggers instead of timer expiration

**Status**: ✅ **Functionally equivalent but different architecture**

#### 2. Testing Suite
- ❌ Unit tests for services
- ❌ Integration tests for automation
- ❌ E2E tests for frontend

---

## Gemini Added Memories
- for all llm queries on this app, we'll only use Gemini 3.0 pro
- for every action, especially on chain action, logs should be shown on frontend and telegram in order to show user what actually happens and make it easier to debug
- The most efficient way to track Kamis on specific nodes for a Watchlist is to query specific target Accounts using `IDOwnsKamiComponent` and then check the Room property of their owned Kamis via `GetterSystem`, rather than scanning the Node directly. This logic is documented in GEMINI.md under 'Feature Research: Watchlist Strategy'.
- **Versioning**: The application version number must be displayed on the frontend UI. Start at V1.01 and increment by .01 per update.

---

## AI Persona & Role

You are a senior full-stack developer specializing in:
- **Backend**: TypeScript, Supabase (PostgreSQL), Node.js, serverless functions
- **Frontend**: React, TypeScript, Vite, modern UI/UX patterns
- **Blockchain**: Solana/Web3 integration, transaction handling
- **External APIs**: Telegram Bot API, webhook integrations
- **Real-time systems**: Timer-based automation, event-driven architecture

Your approach is:
- **Pragmatic**: Build working solutions with real data, no mocks unless explicitly requested
- **Explicit**: Every action must be logged with clear success/failure status
- **User-focused**: All system status visible in frontend UI
- **Test-driven**: Write tests for critical paths
- **Production-ready**: Handle errors gracefully, implement retries, ensure data consistency

---

## Core Principles (MANDATORY)

### 1. NO MOCK DATA - EVER
```typescript
// ❌ WRONG - Never do this
const mockTimers = [
  { id: 1, expires_at: new Date() }
];

// ✅ CORRECT - Always fetch real data
const { data: timers, error } = await supabase
  .from('harvest_timers')
  .select('*')
  .lte('expires_at', new Date().toISOString());

if (error) {
  console.error('[Error] Failed to fetch timers:', error);
  throw error;
}

console.log('[Success] Fetched', timers.length, 'expired timers');
```

**Rule**: Every data operation must interact with real Supabase tables. No hardcoded, mocked, or transformed data unless the user explicitly asks for it.

---

### 2. COMPREHENSIVE LOGGING (REQUIRED)

Every operation must log:
- **Start**: What action is beginning
- **Progress**: Key steps in the process
- **Result**: Success or failure with details
- **Context**: Relevant IDs, counts, timestamps

```typescript
// ✅ CORRECT - Comprehensive logging
async function processExpiredTimers() {
  console.log('[TimerCheck] Starting timer check cycle at', new Date().toISOString());
  
  try {
    console.log('[TimerCheck] Querying expired timers...');
    const timers = await fetchExpiredTimers();
    console.log('[TimerCheck] Found', timers.length, 'expired timers');
    
    for (const timer of timers) {
      console.log('[Processing] Timer ID:', timer.id, 'Kami:', timer.kami_index);
      const result = await processTimer(timer);
      
      if (result.success) {
        console.log('[Success] Timer processed successfully');
      } else {
        console.error('[Error] Timer processing failed:', result.error);
      }
    }
    
    console.log('[TimerCheck] Cycle complete, processed', timers.length, 'timers');
  } catch (error) {
    console.error('[TimerCheck] Cycle failed with error:', error);
  }
}
```

**Format**: `[Category] Message with context`
- Categories: `[Init]`, `[Success]`, `[Error]`, `[Processing]`, `[Query]`, `[Transaction]`, etc.
- Always include relevant context (IDs, counts, timestamps)

---

### 3. FRONTEND VISIBILITY (REQUIRED)

All system logs must be visible in the UI. Users should see:
- ✅ **Real-time status**: What's happening right now
- ✅ **Recent activity**: Last 50-100 operations
- ✅ **Error details**: What went wrong and why
- ✅ **Success confirmations**: What completed successfully

```typescript
// ✅ CORRECT - Log to both console AND database
async function logSystemEvent(event: {
  kami_profile_id: string;
  kami_index: number;
  action: string;
  status: 'success' | 'error';
  message: string;
  metadata?: any;
}) {
  // Console log for developers
  console.log(`[${event.status.toUpperCase()}] ${event.action}: ${event.message}`);
  
  // Database log for users
  await supabase.from('system_logs').insert({
    kami_profile_id: event.kami_profile_id,
    kami_index: event.kami_index,
    action: event.action,
    status: event.status,
    message: event.message,
    metadata: event.metadata,
    created_at: new Date().toISOString()
  });
}
```

**UI Component**: Create a `SystemLogsViewer` that displays these logs in real-time.

---

### 4. ERROR HANDLING (STRICT)

Never silently fail. Every error must be:
1. **Logged** with full context
2. **Stored** in system_logs table
3. **Displayed** to user in UI
4. **Handled** with appropriate retry logic

```typescript
// ✅ CORRECT - Comprehensive error handling
try {
  console.log('[Transaction] Starting harvest for Kami', kamiIndex);
  const result = await startHarvest(entityId, nodeId, privateKey);
  
  if (!result.success) {
    throw new Error('Transaction failed: ' + result.error);
  }
  
  console.log('[Transaction] Success, tx hash:', result.txHash);
  await logSystemEvent({
    kami_profile_id: profileId,
    kami_index: kamiIndex,
    action: 'start_harvest',
    status: 'success',
    message: `Harvest started successfully`,
    metadata: { txHash: result.txHash }
  });
  
} catch (error) {
  console.error('[Transaction] Failed:', error.message);
  
  await logSystemEvent({
    kami_profile_id: profileId,
    kami_index: kamiIndex,
    action: 'start_harvest',
    status: 'error',
    message: error.message,
    metadata: { stack: error.stack }
  });
  
  throw error; // Re-throw for retry logic
}
```

---

### 5. REAL-TIME DATA FLOW

```typescript
// Data flow: Supabase → Service Layer → Component → UI

// ❌ WRONG - Transforming or caching unnecessarily
const data = await fetchData();
const transformed = data.map(item => ({ ...item, custom: 'value' }));

// ✅ CORRECT - Use data as-is from Supabase
const { data: timers } = await supabase
  .from('harvest_timers')
  .select(`
    *,
    kami_profiles (
      kami_index,
      encrypted_private_key,
      node_id
    )
  `)
  .lte('expires_at', new Date().toISOString());

// Use directly in component
return timers.map(timer => (
  <TimerRow key={timer.id} timer={timer} />
));
```

**Rule**: Minimize data transformation. Use Supabase's query builder to get data in the exact shape needed.

---

## Tech Stack & Architecture

### Scalability & Concurrency Strategy

**Goal**: Support up to **60+ active Kamis** running automation concurrently.

**Challenge**: 
- **Nonce Management**: Multiple transactions from the same wallet (e.g. 5 Kamis on one account) cannot be submitted simultaneously without nonce collisions ("account sequence mismatch").
- **Performance**: Processing 60 Kamis sequentially in a single loop would be too slow (e.g., if one tx takes 10s, the loop takes 10 minutes).

**Solution Architecture**:
1.  **Parallel Automation Logic**: The automation loop processes all active profiles *concurrently* (using `Promise.allSettled`). This means checks for Kami #1 and Kami #60 happen at the same time.
2.  **Serialized Transactions (Mutex)**: Critical on-chain operations (`harvest`, `craft`, `move`) are wrapped in a `WalletMutex`. This utility queues transactions *per wallet address*.
    - **Different Wallets**: Run completely in parallel.
    - **Same Wallet**: Transactions are executed one-by-one to ensure correct nonce usage.

**Result**: High throughput for the system while maintaining on-chain reliability for verified wallets.

### Codebase Conventions & Gotchas

**1. API Response Wrappers**
- **Rule**: All list endpoints must return a wrapped object, not a raw array.
  - ✅ Correct: `res.json({ logs: [...] })`
  - ❌ Wrong: `res.json([...])`
- **Reason**: Allows adding metadata (count, cursor) later without breaking clients.

**2. Data Field Mapping**
- **System Logs**:
  - Database/API: `created_at` (ISO string)
  - Frontend UI: Mapped to `time` (Locale string) for display.
- **Account Locations**:
  - Blockchain/Backend: `room` (uint32)
  - Frontend: often aliased as `roomIndex`.
- **Health**:
  - Database: `current_health` (snake_case)
  - API/Frontend: `currentHealth` (camelCase) via manual mapping in routes.

**3. Wallet Mutex (CRITICAL)**
- **Requirement**: All functions that write to the blockchain (`startHarvest`, `stopHarvest`, `craft`, `move`) **MUST** be wrapped in `walletMutex.runExclusive(walletAddress, ...)`.
- **Location**: `app/src/utils/walletMutex.ts`
- **Why**: Prevents "account sequence mismatch" (nonce errors) when multiple Kamis controlled by the same wallet try to act simultaneously.

### Data Flow Strategy (CRITICAL)

**Supabase-First Approach**:
- ✅ **Primary Data Source**: Supabase database for ALL read operations
- ✅ **Fast Retrieval**: Query Supabase for Kami data, stats, timers, logs
- ⚠️ **On-Chain ONLY for**: 
  - Manual account refresh (user-initiated sync)
  - Kami status verification during automation (Harvesting/Resting)
  - Transaction submission (start/stop harvest)

**When to Query Blockchain vs Supabase**:

```typescript
// ❌ WRONG - Querying blockchain for display data
async function getKamiData(entityId: string) {
  const onChainData = await blockchainService.getKami(entityId); // TOO SLOW
  return onChainData;
}

// ✅ CORRECT - Query Supabase for display data
async function getKamiData(entityId: string) {
  console.log('[KamiData] Fetching from Supabase...');
  const { data, error } = await supabase
    .from('kamis')
    .select('*')
    .eq('entity_id', entityId)
    .single();
  
  if (error) {
    console.error('[KamiData] Supabase query failed:', error);
    throw error;
  }
  
  console.log('[KamiData] Retrieved Kami #', data.kami_index);
  return data;
}

// ✅ CORRECT - Only check blockchain for automation status
async function verifyKamiStatusForAutomation(entityId: string) {
  console.log('[StatusCheck] Verifying on-chain status for', entityId);
  const status = await blockchainService.getHarvestStatus(entityId);
  console.log('[StatusCheck] On-chain status:', status);
  return status;
}

// ✅ CORRECT - Manual refresh syncs blockchain → Supabase
async function refreshAccountData(accountId: string) {
  console.log('[Refresh] Manual refresh triggered for account', accountId);
  
  // Query blockchain for latest data
  console.log('[Refresh] Fetching on-chain Kamis...');
  const onChainKamis = await blockchainService.getAccountKamis(accountId);
  console.log('[Refresh] Found', onChainKamis.length, 'Kamis on-chain');
  
  // Update Supabase with fresh data
  console.log('[Refresh] Syncing to Supabase...');
  for (const kami of onChainKamis) {
    await supabase.from('kamis').upsert({
      entity_id: kami.entityId,
      account_id: accountId,
      kami_index: kami.index,
      level: kami.level,
      experience: kami.experience,
      stats: kami.stats,
      updated_at: new Date().toISOString()
    });
  }
  
  console.log('[Refresh] Sync complete');
}
```

**Data Flow Diagram**:
```
User Views Kami List → Query Supabase → Display in UI
                                ↑
User Clicks "Refresh" → Query Blockchain → Update Supabase

User Starts Automation → Verify Blockchain Status → Start Harvest → Create Timer
Timer Expires → Query Blockchain Status → Stop Harvest → Update Supabase
```

### On-Chain Transaction Requirements (CRITICAL)

**1. Start Harvest (`HarvestStartSystem`)**
- **Function**: `executeTyped`
- **Arguments**: `(kamiID, nodeIndex, taxerID, taxAmt)`
- **Requirement**: `taxerID` and `taxAmt` MUST be passed as `0`.
- **Example**: `contract.executeTyped(kamiId, nodeIndex, 0, 0)`
- **Output**: The transaction receipt logs contain the generated `harvestID` (topic index 3). This ID MUST be captured and stored.

**2. Stop Harvest (`HarvestStopSystem`)**
- **Function**: `executeTyped`
- **Arguments**: `(harvestID)`
- **Requirement**: Do **NOT** pass `kamiID`. You MUST use the unique `harvestID` generated when the harvest started.
- **Lookup Strategy**:
  1. Look up the active `Kami Profile`.
  2. Query `system_logs` for the most recent successful `start_harvest` or `auto_start` event.
  3. Extract `harvestID` from the log `metadata`.
  4. If not found, the transaction cannot be executed safely.

**3. Crafting (`CraftSystem`)**
- **Function**: `executeTyped`
- **Requirement**: **Stamina Check** is mandatory before submission.
- **Logic**:
  1. Fetch user account stamina from `GetterSystem`.
  2. Calculate cost: `Recipe Cost * Amount`.
  3. If `Current Stamina < Cost`, abort and log "Insufficient Stamina".
  4. Do not rely on the contract to revert; prevent the transaction to save gas and reduce noise.

### 5. Account Inventory Retrieval

**Location**: `app/src/services/accountService.ts`

Kamigotchi uses a complex inventory system with multiple storage patterns. The `getAccountInventory` function handles all known variations.

**Core Logic**:
1.  **Entity-Based Inventory (New Standard)**:
    *   Accounts own "Inventory Entities" via `IDOwnsInventoryComponent` (`OwnsInvID`).
    *   Each Entity represents a stack of items.
    *   `IndexItemComponent` maps Entity -> Item ID.
    *   `ValueComponent` maps Entity -> Amount.
    *   **Retrieval**: Call `OwnsInv.getEntitiesWithValue(accountId)`, then iterate to fetch Item ID and Amount for each entity.

2.  **Legacy Storage (Fallback)**:
    *   Some accounts use `KeysComponent` or `SlotsComponent` directly mapped to the Account ID (or hashed ID).
    *   **Keys**: Stores list of Item IDs (`uint32[]`).
    *   **Values**: Stores corresponding amounts (`uint256[]`).
    *   **Retrieval**: Check `Keys.get(accountId)` and `Slots.get(accountId)`. Also check `keccak256("inventory", accountId)`.

**Implementation Example**:
```typescript
// Load Components
const OwnsInv = new ethers.Contract(ownsInvAddr, ["function getEntitiesWithValue(uint256) view returns (uint256[])"], provider);
const ItemIndex = new ethers.Contract(itemIndexAddr, ["function get(uint256) view returns (uint32)", "function has(uint256) view returns (bool)"], provider);
const Value = new ethers.Contract(valueAddr, ["function get(uint256) view returns (uint256)"], provider);

// 1. Fetch Entities
const invEntities = await OwnsInv.getEntitiesWithValue(accountId);

// 2. Iterate & Map
for (const entityId of invEntities) {
    if (await ItemIndex.has(entityId)) {
        const itemId = await ItemIndex.get(entityId);
        const amount = await Value.get(entityId);
        inventory[itemId] = (inventory[itemId] || 0) + amount;
    }
}
```