# Corrections Log

## 2025-12-13: Fix Location Logic & Log Redundancy

### Issue
1. Logs contained redundant prefixes: `[Kami #10476] [Auto Harvest: Eerie] ...`.
2. Automation failed with "Account is in Room #69, but target is Node #0" because unconfigured profiles defaulted to Node 0 instead of the current location.

### Changes Applied
1. **Frontend**: 
   - Edited `app/frontend/src/components/CharacterManagerPWA.tsx`.
   - Removed the conditional logic that prepended `[Kami #...]` to log messages in both the initial fetch and real-time subscription handlers.

2. **Backend**:
   - Edited `app/src/services/automationService.ts`.
   - Updated `checkKami` function (Rest restart block).
   - Changed target node logic: `const nodeIndex = profile.harvest_node_index ?? account?.room ?? 0;`.
   - This ensures if `harvest_node_index` is null (not set), it defaults to the account's current room, preventing false location errors.
   - Also fixed a bug introduced in the previous step where `kamiData` was accessed before initialization.

### Verification
- `npm run build` passed.
- Logs should now be clean: `[Auto Harvest: Eerie] ...`.
- Automation should correctly restart harvest in the current room if no specific node is targeted.
