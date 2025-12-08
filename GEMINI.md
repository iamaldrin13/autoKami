# GEMINI.md - Kami Automation System

## 🎯 PROJECT STATUS (Updated: 2025-12-04)

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
- ✅ **API Routes**:
  - `accountRoutes.ts`, `farmingRoutes.ts`, `harvestRoutes.ts`
  - `kamigotchiRoutes.ts`, `kamiRoutes.ts`, `profileRoutes.ts`
  - `systemRoutes.ts`, `transactionRoutes.ts`

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

### Database Layer: Supabase (PostgreSQL)

**Core Tables**:
```sql
-- Automation tables
harvest_timers (id, kami_profile_id, kami_entity_id, kami_index, expires_at, retry_count, last_error, last_error_at)
rest_timers (id, kami_profile_id, kami_entity_id, kami_index, expires_at, retry_count, last_error, last_error_at)
kami_profiles (id, user_id, kami_entity_id, kami_index, encrypted_private_key, node_id, harvest_duration, rest_duration)
system_logs (id, kami_profile_id, kami_index, action, status, message, metadata, created_at)
user_settings (id, user_id, telegram_chat_id, telegram_notifications_enabled)

-- Kami data cache (synced from blockchain)
kamis (
  id UUID PRIMARY KEY,
  entity_id VARCHAR(255) UNIQUE NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  kami_index INTEGER NOT NULL,
  level INTEGER,
  experience BIGINT,
  stats JSONB, -- {vitality, strength, intelligence, luck}
  affinity VARCHAR(50),
  current_status VARCHAR(50), -- 'Harvesting', 'Resting', 'Idle'
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Accounts cache
accounts (
  id UUID PRIMARY KEY,
  account_id VARCHAR(255) UNIQUE NOT NULL,
  owner_address VARCHAR(255),
  kami_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kamis_account_id ON kamis(account_id);
CREATE INDEX idx_kamis_entity_id ON kamis(entity_id);
CREATE INDEX idx_kamis_last_synced ON kamis(last_synced_at);
```

**Key Constraints**:
- `UNIQUE(kami_profile_id)` on both timer tables (prevents duplicates)
- `ON DELETE CASCADE` for foreign keys
- Indexes on `expires_at` for performance

**Client Usage**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Always use strongly-typed queries
const { data, error } = await supabase
  .from('harvest_timers')
  .select('*')
  .eq('kami_profile_id', profileId)
  .single();
```

---

### Backend Layer: Supabase Edge Functions

**Serverless Functions** (Deno/TypeScript):
- `/timer-processor`: Runs every 1 minute via cron
- `/start-automation`: User action endpoint
- `/stop-automation`: User action endpoint
- `/send-telegram`: Notification sender

**Pattern**:
```typescript
// supabase/functions/timer-processor/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  console.log('[EdgeFunction] Timer processor invoked at', new Date().toISOString());
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    const result = await processExpiredTimers(supabase);
    console.log('[EdgeFunction] Processed', result.count, 'timers');
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('[EdgeFunction] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
```

**Cron Setup** (`supabase/functions/timer-processor/cron.yml`):
```yaml
- name: "timer-processor"
  schedule: "* * * * *" # Every 1 minute
```

---

### Frontend Layer: Vite + React + TypeScript

**Project Structure**:
```
src/
├── components/
│   ├── KamiTimerDisplay.tsx
│   ├── SystemLogsViewer.tsx
│   ├── HealthDashboard.tsx
│   └── AutomationControls.tsx
├── services/
│   ├── supabase.ts
│   ├── automation.ts
│   ├── blockchain.ts
│   └── telegram.ts
├── hooks/
│   ├── useTimers.ts
│   ├── useSystemLogs.ts
│   └── useAutomation.ts
├── types/
│   └── database.ts
└── App.tsx
```

**Component Pattern**:
```typescript
// src/components/KamiTimerDisplay.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export function KamiTimerDisplay({ kamiProfileId }: { kamiProfileId: string }) {
  const [timer, setTimer] = useState<Timer | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  useEffect(() => {
    console.log('[KamiTimer] Fetching timer for profile', kamiProfileId);
    
    async function fetchTimer() {
      const { data, error } = await supabase
        .from('harvest_timers')
        .select('*, kami_profiles(*)')
        .eq('kami_profile_id', kamiProfileId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('[KamiTimer] Fetch error:', error);
        return;
      }
      
      if (data) {
        console.log('[KamiTimer] Timer found, expires at', data.expires_at);
        setTimer(data);
        setTimeRemaining(new Date(data.expires_at).getTime() - Date.now());
      } else {
        console.log('[KamiTimer] No active timer');
        setTimer(null);
      }
    }
    
    fetchTimer();
    const interval = setInterval(fetchTimer, 10000); // Refresh every 10s
    
    return () => clearInterval(interval);
  }, [kamiProfileId]);
  
  // Countdown logic...
}
```

**Hook Pattern**:
```typescript
// src/hooks/useTimers.ts
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export function useTimers(kamiProfileId: string) {
  const [timer, setTimer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    console.log('[useTimers] Subscribing to timers for', kamiProfileId);
    
    // Initial fetch
    fetchTimer();
    
    // Real-time subscription
    const subscription = supabase
      .channel(`timer:${kamiProfileId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'harvest_timers',
          filter: `kami_profile_id=eq.${kamiProfileId}`
        }, 
        (payload) => {
          console.log('[useTimers] Timer updated:', payload);
          fetchTimer();
        }
      )
      .subscribe();
    
    return () => {
      console.log('[useTimers] Unsubscribing');
      subscription.unsubscribe();
    };
  }, [kamiProfileId]);
  
  async function fetchTimer() {
    const { data, error } = await supabase
      .from('harvest_timers')
      .select('*')
      .eq('kami_profile_id', kamiProfileId)
      .maybeSingle();
      
    if (error) {
      console.error('[useTimers] Fetch error:', error);
    } else {
      console.log('[useTimers] Timer fetched:', data?.id || 'none');
      setTimer(data);
    }
    
    setLoading(false);
  }
  
  return { timer, loading, refetch: fetchTimer };
}
```

---

### External Integration: Telegram Bot API

**Notification Service**:
```typescript
// src/services/telegram.ts
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramNotification(params: {
  chatId: string;
  kamiIndex: number;
  errorMessage: string;
  retryCount: number;
}) {
  console.log('[Telegram] Sending notification to chat', params.chatId);
  
  const message = `
🚨 *Kami Automation Error*

*Kami:* #${params.kamiIndex}
*Status:* Failed after ${params.retryCount} attempts

*Error:* ${params.errorMessage}

⚠️ Automation has been stopped for this Kami.
  `.trim();
  
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
    
    console.log('[Telegram] Notification sent successfully');
    return { success: true };
    
  } catch (error) {
    console.error('[Telegram] Failed to send notification:', error);
    return { success: false, error: error.message };
  }
}
```

**Getting Chat ID**:
Users get their chat ID by messaging the bot with `/start`, which triggers a webhook that stores their chat_id.

---

## Development Workflow

### Task-by-Task Execution

When starting a new task:

1. **Read the task requirements** from the agent todo list
2. **Confirm understanding**: "Starting Task X.Y: [Task Name]"
3. **Create the file/function** with full implementation
4. **Add comprehensive logging** at every step
5. **Test with real data** - no mocks
6. **Verify logs appear** in console and database
7. **Confirm completion**: "Task X.Y complete. Ready for next task."

### Code Review Checklist (Before Marking Task Complete)

- [ ] No mock data used anywhere
- [ ] Every operation has console.log() statements
- [ ] Critical operations logged to system_logs table
- [ ] All errors caught and logged
- [ ] Success cases logged with context
- [ ] TypeScript types defined (no `any`)
- [ ] Database queries use real Supabase client
- [ ] Frontend displays real-time data
- [ ] Component re-renders on data changes

---

## Logging Standards

### Console Logging Format

```typescript
// Pattern: [CATEGORY] Message with context

console.log('[Init] Starting timer processor...');
console.log('[Query] Fetching expired timers from database');
console.log('[Success] Found 5 expired timers');
console.log('[Processing] Timer ID: abc-123, Kami: #42');
console.log('[Transaction] Submitting stopHarvest tx...');
console.log('[Verification] Blockchain status: Resting');
console.log('[Timer] Created rest timer, expires at 2024-01-15T10:30:00Z');
console.log('[Error] Transaction failed: Network timeout');
```

**Categories**:
- `[Init]` - Initialization and startup
- `[Query]` - Database queries
- `[Success]` - Successful operations
- `[Error]` - Errors and failures
- `[Processing]` - Processing steps
- `[Transaction]` - Blockchain transactions
- `[Verification]` - Status checks
- `[Timer]` - Timer operations
- `[Telegram]` - Notifications
- `[Cleanup]` - Cleanup operations

### Database Logging (system_logs table)

```typescript
// Log important events to database for user visibility
await supabase.from('system_logs').insert({
  kami_profile_id: profileId,
  kami_index: kamiIndex,
  action: 'stop_harvest', // or 'start_harvest', 'timer_expired', etc.
  status: 'success', // or 'error'
  message: 'Harvest stopped successfully, rest timer created',
  metadata: {
    timer_id: timerId,
    expires_at: expiresAt,
    tx_hash: txHash
  },
  created_at: new Date().toISOString()
});
```

**When to log to database**:
- ✅ User actions (start/stop automation)
- ✅ Timer expirations and state changes
- ✅ Blockchain transactions
- ✅ Errors that affect user's automation
- ✅ Retry attempts
- ❌ Routine queries (just console log)
- ❌ UI component renders

---

## Error Handling Patterns

### Blockchain Transaction Errors

```typescript
try {
  console.log('[Transaction] Starting harvest for Kami', kamiIndex);
  
  const txResult = await startHarvest(entityId, nodeId, privateKey);
  
  if (!txResult.success) {
    throw new Error(txResult.error);
  }
  
  console.log('[Transaction] Success, tx hash:', txResult.txHash);
  console.log('[Transaction] Waiting 2s for confirmation...');
  
  await sleep(2000);
  
  console.log('[Verification] Checking blockchain status...');
  const status = await getHarvestStatus(entityId);
  
  if (status.status !== 'Harvesting') {
    throw new Error(`Status mismatch: expected Harvesting, got ${status.status}`);
  }
  
  console.log('[Verification] Confirmed: Kami is harvesting');
  
} catch (error) {
  console.error('[Transaction] Failed:', error.message);
  
  await logSystemEvent({
    kami_profile_id: profileId,
    kami_index: kamiIndex,
    action: 'start_harvest',
    status: 'error',
    message: `Transaction failed: ${error.message}`,
    metadata: { error: error.stack }
  });
  
  throw error; // Re-throw for retry handler
}
```

### Database Query Errors

```typescript
console.log('[Query] Fetching expired harvest timers...');

const { data: timers, error } = await supabase
  .from('harvest_timers')
  .select('*, kami_profiles(*)')
  .lte('expires_at', new Date().toISOString())
  .limit(10);

if (error) {
  console.error('[Query] Database error:', error.message);
  
  await logSystemEvent({
    kami_profile_id: 'system',
    kami_index: 0,
    action: 'query_timers',
    status: 'error',
    message: `Database query failed: ${error.message}`,
    metadata: { error: error.details }
  });
  
  throw error;
}

console.log('[Query] Found', timers.length, 'expired timers');
```

### Network/API Errors

```typescript
console.log('[Telegram] Sending error notification...');

try {
  const response = await fetch(telegramApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  console.log('[Telegram] Notification sent successfully');
  
} catch (error) {
  console.error('[Telegram] Failed to send notification:', error.message);
  // Don't throw - notification failure shouldn't break automation
  // Just log and continue
}
```

---

## Testing Requirements

### Manual Testing Steps (For Each Task)

1. **Console Verification**:
   - Open browser DevTools → Console
   - Trigger the action
   - Verify all expected log messages appear
   - Check for any errors

2. **Database Verification**:
   - Query Supabase directly to confirm data changes
   - Check system_logs table for logged events
   - Verify timestamps and data accuracy

3. **UI Verification**:
   - Check that UI updates reflect database state
   - Verify logs appear in SystemLogsViewer
   - Confirm real-time updates work

4. **Error Scenario Testing**:
   - Force an error (disconnect network, invalid data, etc.)
   - Verify error is logged to console
   - Verify error is logged to database
   - Verify error is displayed in UI
   - Verify system recovers gracefully

### Integration Testing

```typescript
// Example: Test full automation cycle
describe('Automation Cycle', () => {
  it('should complete harvest → rest → harvest cycle', async () => {
    // Start automation
    console.log('[Test] Starting automation...');
    const startResult = await startAutomation(kamiProfileId);
    expect(startResult.success).toBe(true);
    
    // Verify harvest timer created
    console.log('[Test] Verifying harvest timer...');
    const harvestTimer = await supabase
      .from('harvest_timers')
      .select('*')
      .eq('kami_profile_id', kamiProfileId)
      .single();
    expect(harvestTimer.data).toBeTruthy();
    
    // Simulate timer expiration (fast-forward time in test)
    console.log('[Test] Simulating timer expiration...');
    await updateTimerExpiration(harvestTimer.data.id, new Date());
    
    // Run timer processor
    console.log('[Test] Running timer processor...');
    await processExpiredTimers();
    
    // Verify rest timer created
    console.log('[Test] Verifying rest timer...');
    const restTimer = await supabase
      .from('rest_timers')
      .select('*')
      .eq('kami_profile_id', kamiProfileId)
      .single();
    expect(restTimer.data).toBeTruthy();
    
    console.log('[Test] Cycle test passed');
  });
});
```

---

## Environment Variables

### Required Environment Variables

**Frontend** (`.env`):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TELEGRAM_BOT_TOKEN=your-bot-token
```

**Supabase Edge Functions** (Supabase dashboard):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TELEGRAM_BOT_TOKEN=your-bot-token
```

### Security Notes

- ❌ Never commit `.env` files
- ❌ Never log sensitive keys
- ✅ Use service role key only in Edge Functions
- ✅ Use anon key in frontend (with RLS policies)

---

## Common Mistakes to Avoid

### ❌ DON'T: Use mock data

```typescript
// WRONG
const mockTimers = [{ id: '1', expires_at: new Date() }];
setTimers(mockTimers);
```

### ✅ DO: Fetch real data

```typescript
// CORRECT
const { data } = await supabase.from('harvest_timers').select('*');
setTimers(data);
```

---

### ❌ DON'T: Transform data unnecessarily

```typescript
// WRONG - Adds complexity
const transformed = data.map(item => ({
  ...item,
  displayName: `Kami #${item.kami_index}`
}));
```

### ✅ DO: Transform in component if needed

```typescript
// CORRECT - Keep data pure, transform in render
{timers.map(timer => (
  <div key={timer.id}>
    Kami #{timer.kami_index}
  </div>
))}
```

---

### ❌ DON'T: Silent failures

```typescript
// WRONG
try {
  await doSomething();
} catch (error) {
  // Silent failure - no logging
}
```

### ✅ DO: Log all errors

```typescript
// CORRECT
try {
  console.log('[Action] Doing something...');
  await doSomething();
  console.log('[Action] Success');
} catch (error) {
  console.error('[Action] Failed:', error.message);
  throw error;
}
```

---

### ❌ DON'T: Forget to log to database

```typescript
// WRONG - Only console log
console.log('Timer expired');
```

### ✅ DO: Log important events to database

```typescript
// CORRECT
console.log('[Timer] Timer expired for Kami', kamiIndex);

await supabase.from('system_logs').insert({
  kami_profile_id: profileId,
  kami_index: kamiIndex,
  action: 'timer_expired',
  status: 'success',
  message: 'Harvest timer expired, transitioning to rest',
  created_at: new Date().toISOString()
});
```

---

## Response Format

When you receive a task, respond in this format:

```
✅ Task [X.Y]: [Task Name]

📋 Requirements understood:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

🔨 Implementation approach:
[Explain your approach in 2-3 sentences]

📝 Files to create/modify:
- [File 1]
- [File 2]

[Then provide the complete code implementation]

✅ Logging implemented:
- Console logs: [describe what's logged]
- Database logs: [describe what's stored]

✅ Testing notes:
[How to test this task]

Ready for review. Should I proceed with this implementation?
```

---

## Final Checklist (Before Completing Any Task)

- [ ] No mock data anywhere in the code
- [ ] All operations have console.log() statements
- [ ] Important events logged to system_logs table
- [ ] All errors caught and logged
- [ ] Real Supabase queries used
- [ ] TypeScript types defined (no `any` unless necessary)
- [ ] UI displays real-time data
- [ ] Tested manually with real data
- [ ] Logs visible in browser console
- [ ] Logs visible in SystemLogsViewer component

---

## 📊 Current System Architecture Summary

### Data Flow (As Implemented)
```
User Login (Privy) → Frontend (React PWA) → API Server (Express) → Automation Loop (60s)
                                                                    ↓
                                          Supabase DB ← → Blockchain (Yominet)
                                                ↓
                                          System Logs Table
```

### Key Architectural Decisions Made

#### 1. **Polling vs Timer-based Architecture**
- **Original spec**: Timer tables with `expires_at` + Edge Function cron
- **Implemented**: Polling loop with `last_harvest_start`/`last_collect` timestamps
- **Rationale**: Simpler deployment, in-process automation, no Edge Function dependencies
- **Trade-off**: Slightly less precise timing, but 60s granularity is acceptable

#### 2. **Authentication**
- **Implemented**: Privy for wallet authentication
- **Benefit**: Seamless Web3 UX, no password management

#### 3. **Multi-wallet Architecture**
- **Implemented**: Operator wallets table for team management
- **Feature**: Users can manage multiple Kamigotchi teams with different wallets

#### 4. **Encryption**
- **Implemented**: AES-256-GCM for private key storage
- **Security**: Keys encrypted at rest, decrypted only during transactions

### Current Production Status
- ✅ **Deployed**: Docker + Tailscale
- ✅ **Running**: Automation loop processing Kamis every 60 seconds
- ✅ **Monitoring**: System logs table captures all events
- ✅ **Frontend**: PWA accessible with multi-theme support

### Next Steps for Future Development
1. **Telegram Integration**: Complete webhook setup and notification flow
2. **Testing**: Add comprehensive test coverage
3. **Edge Functions** (Optional): Migrate automation to Supabase Edge Functions for better scaling
4. **Analytics Dashboard**: Visualize harvest earnings, automation statistics
5. **Mobile Optimization**: Enhanced PWA features for mobile users

## Feature Research: Watchlist Strategy

### Goal
Efficiently track whether specific accounts or Kamigotchis are harvesting on specific nodes (e.g., monitoring if 'boom' is at Node 72).

### Strategy Comparison

#### 1. Node-Based Scanning (Tried & Rejected)
*   **Approach**: Query `IndexRoomComponent` or `IndexNodeComponent` to get all entities at a specific `NodeIndex`.
*   **Result**: The `getEntitiesWithValue` call failed for these components (likely due to large return data or ABI mismatch).
*   **Fallback**: Scanning `getKamiByIndex(0...N)` to find Kamis at the node.
*   **Performance**: O(N) where N is total Kamis. Very slow (scanned 2000 indices).
*   **Verdict**: **Inefficient** for real-time tracking.

#### 2. Account-Based Tracking (Recommended)
*   **Approach**: Target specific accounts of interest. Query their owned entities and check *their* location.
*   **Performance**: O(1) + O(K) where K is owned Kamis (usually < 50). Extremely fast.
*   **Verdict**: **Optimal**.

### Implementation Pattern

**Key Components**:
*   `IDOwnsKamiComponent`: Maps Account ID -> List of Kami Entity IDs.
*   `GetterSystem`: Provides `getAccount(id)` and `getKami(id)`.
*   `KamiIndex`: Helper to get the user-friendly Kami Index (e.g., #980) from the long Entity ID.

**Code Snippet (Service Layer)**:

```typescript
async function checkAccountActivity(targetAccountId: string, targetNodeIndex: number) {
    // 1. Get Owned Kamis
    const ownedEntities = await OwnsKamiContract.getEntitiesWithValue(BigInt(targetAccountId));
    
    const matches = [];
    
    // 2. Check each Kami's Status
    for (const entityId of ownedEntities) {
        const kami = await GetterSystem.getKami(entityId);
        
        if (Number(kami.room) === targetNodeIndex) {
            matches.push({
                id: entityId.toString(),
                name: kami.name,
                state: kami.state, // 'HARVESTING' or 'RESTING'
                index: await getKamiIndex(entityId)
            });
        }
    }
    
    return matches;
}
```

---

## Getting Started

When you receive this `GEMINI.md` file, respond with:

```
✅ GEMINI.md instructions loaded and understood.

Configuration confirmed:
- Tech Stack: Supabase + Express + Vite + React + TypeScript + Docker
- Current Status: PRODUCTION READY ✅
  - Database: ✅ Complete
  - Backend: ✅ Complete
  - Automation: ✅ Running (60s interval)
  - Frontend: ✅ Complete
  - Logging: ✅ Implemented
  - Deployment: ✅ Dockerized
- No mock data policy: ACTIVE
- Comprehensive logging: IMPLEMENTED
- Frontend visibility: ACTIVE


## On-Chain Implementation Reference

### 1. Standard Transaction Flow

1.  **Load Configuration**: Import `SYSTEMS` IDs and `ABIs` using the `contractLoader` utility.
2.  **Resolve Address**: Convert the System's `encodedID` (from `systems.json`) into a contract address using the `World` registry.
3.  **Prepare Wallet**: Initialize `ethers.Wallet` with the decrypted private key.
4.  **Execute**:
    *   **Harvesting**: Use `contract.executeTyped(...)`.
    *   **Crafting**: Use raw transaction data construction (selector + args) for reliability.
5.  **Confirm & Log**: Wait for receipt, extract return values (like `HarvestID`), and log to `system_logs`.

### 2. Address Resolution Pattern

**Location**: `app/src/services/transactionService.ts`

```typescript
import { loadIds } from '../utils/contractLoader.js';
const SYSTEMS = loadIds('systems.json');

export async function getSystemAddress(systemId: string): Promise<string> {
  // 1. Get Encoded ID
  const encodedId = systemId; // e.g. SYSTEMS.HarvestStartSystem.encodedID

  // 2. Query World Registry
  const systemsRegistryAddress = await world.systems();
  const systemsRegistry = new ethers.Contract(systemsRegistryAddress, RegistryABI, provider);

  // 3. Get Entity ID -> Address
  const systemAddresses = await systemsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
  const entityId = BigInt(systemAddresses[0].toString());
  
  // 4. Convert to Hex Address
  return ethers.getAddress('0x' + entityId.toString(16).padStart(40, '0'));
}
```

### 3. Harvest Transactions

**Start Harvest (4 Arguments Required)**
```typescript
// Imports
const HarvestStartSystem = loadAbi('HarvestStartSystem.json');
const systemId = SYSTEMS.HarvestStartSystem.encodedID;

// Execution
const contract = new ethers.Contract(await getSystemAddress(systemId), HarvestStartSystem.abi, wallet);

// CRITICAL: Must pass 4 arguments. Last two are TaxerID and TaxAmount (0 for both).
const tx = await contract.executeTyped(
  BigInt(kamiId), 
  BigInt(nodeIndex), 
  BigInt(0), // taxerID
  BigInt(0), // taxAmt
  { gasLimit: 2000000 }
);

// Parsing HarvestID from Receipt
const receipt = await tx.wait();
const harvestId = getHarvestIdFromReceipt(receipt); // Extracts from log topics[3]
```

**Stop Harvest (Uses HarvestID)**
```typescript
// Imports
const HarvestStopSystem = loadAbi('HarvestStopSystem.json');
const systemId = SYSTEMS.HarvestStopSystem.encodedID;

// Execution
const contract = new ethers.Contract(await getSystemAddress(systemId), HarvestStopSystem.abi, wallet);

// CRITICAL: Must use HarvestID, NOT KamiID
const tx = await contract.executeTyped(
  BigInt(harvestId), // Retrieved from system_logs or state
  { gasLimit: 2000000 }
);
```

### 4. Crafting Transactions (Raw Data Pattern)

**Location**: `app/src/services/craftingService.ts`

For crafting, we construct the transaction data manually to ensure correct selector usage (`0x5c817c70`).

```typescript
const systemId = SYSTEMS.CraftSystem.encodedID;
const systemAddress = await getSystemAddress(systemId);

// Selector for craft(uint32,uint256)
const selector = "0x5c817c70";
const arg1 = recipeIndex.toString(16).padStart(64, '0');
const arg2 = amount.toString(16).padStart(64, '0');
const data = selector + arg1 + arg2;

// Explicit Nonce Management (Recommended for high frequency)
const nonce = await provider.getTransactionCount(wallet.address, 'pending');

const tx = await wallet.sendTransaction({
    to: systemAddress,
    data: data,
    gasLimit: 3000000,
    nonce: nonce
});
```

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