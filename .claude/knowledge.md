# Project Knowledge

## Project Structure
- `src/types/crawlv2.ts` — Board layout, Location type, zone definitions. Locations have `behind`/`inFront` optional string fields pointing to location IDs.
- `src/types/cards.ts` — Card types, EffectDef, Check system types, default unit effects (summon, sacrifice, swapStance, attack), and card definitions.
- `src/composables/crawlv2/CheckSystem.ts` — Comparator-based check system for evaluating conditions/targets. Comparators: equals, not_equals, less_than, more_than, location, itself, owner, current_player, is_undefined, location_check. `filterByTargets` unions cards matching any check group. Check groups are OR'd, checks within a group are AND'd.
- `src/composables/crawlv2/EffectHandlers.ts` — Effect handler implementations (damage, buff, debuff, summon, etc.). The `damage` handler is the attack handler. Handlers are keyed by name in `effectHandlers` record.
- `src/composables/crawlv2/EffectResolver.ts` — Singleton class that registers event-triggered effects, handles manual activation via `activateEffect`, and manages the effect lifecycle (eventName emission, handler invocation, effectEnded, then/and chaining).
- `src/composables/crawlv2/BuffSystem.ts` — `getEffective()` returns effective stats with buffs/debuffs applied.
- `src/composables/crawlv2/EventBus.ts` — Event system for game events.
- `src/composables/crawlv2/CardMovement.ts` — Card movement utilities.
- `src/composables/crawlv2/useTargetSelector.ts` — Vue composable for target/zone/card selection UI. `selectTargets` auto-selects when `!optional && (maxTargets === undefined || validTargets.length === 1)`, otherwise prompts.

## Architecture
- Effects are declarative: EffectDef objects define triggers, conditions, targets, and the handler name.
- Target filtering uses Check[][] (OR of AND groups) evaluated by CheckSystem.
- Each card has a `location: Location` with an `id` matching the board locations array.
- The board has front/back unit rows per player: player1 has unit11-13 (with `behind` pointing to unit14-16) and unit14-16 (with `inFront`). Player2 has unit21-23 (with `inFront` pointing to unit24-26) and unit24-26 (with `behind` pointing to unit21-23).

## Effect Chaining
- `then?: EffectDef` — Sequential/conditional: only fires if the parent effect resolved successfully (`ctx.resolved` is true, not cancelled). Used for "do X and if you do, do Y" cards.
- `and?: EffectDef[]` — Independent/parallel: all sibling effects fire regardless of parent resolution. Each can be individually negated. Used for cards with multiple independent effects from a single trigger.
- `autoTarget?: 'event_source' | 'event_target'` — Auto-resolves targets from event data. In the resolver's event listener, creates a handler-only effect copy with targets pinned to the specific card's gameId and `optional: false` / `selectCount: undefined`, so the handler auto-selects without prompting. The "activate?" prompt from the original `optional: true` still fires before the handler.

## Target Selection Flow
- `optional` on EffectDef does double duty: (1) in EffectResolver it triggers the "activate?" prompt via `config.ask`, (2) in `useTargetSelector.selectTargets` it forces the target selection UI even with a single target.
- `autoTarget` decouples these: the activate prompt uses the original effect's `optional`, while the handler receives a modified copy with `optional: false` for auto-selection.

## Condition System
- Conditions use a `test` field: `has_card`, `event_target`, `event_source`, `has_property`, `has_energy`, `trigger_effect`.
- `event_source`/`event_target` conditions check against the card that caused/received the event.
- `trigger_effect` conditions check against the EffectDef that triggered the event (useful for Spell Breaker cards).
- `has_energy` compares current player AP against the card's cost.

## Hand Buffs
- `retain` buff can be applied to cards in the hand. At TURN_START, cards with `retain > 0` skip the "spend all hand cards" step. The buff decrements by 1 each turn it prevents a discard.
- The `gain_ap` effect handler supports a `delay` option (number of owner turns to wait before granting AP). It registers a one-time TURN_START listener that self-cleans.

## Damage Type Effectiveness
- `src/composables/crawlv2/DamageTypes.ts` — Type effectiveness map, multiplier (1.5x), and helpers (`getTypeEffectiveAtk`, `isTypeEffective`, `getEffectiveDamageType`).
- Types: cosmic, psychic, necrotic, fire, physical, magic. Each card has a `damage` field on the Card type.
- Effectiveness: cosmic > necrotic/psychic/physical, psychic > necrotic/fire, necrotic > psychic/magic, fire > physical, physical > magic, magic > fire.
- `resolveCombat` in EffectHandlers uses `getTypeEffectiveAtk` for both attacker and defender ATK calculations.
- During attack target selection, `attackingCard` and `hoveredTarget` refs in `useTargetSelector` track hover state so CardBase can preview effective ATK with type advantage.
- Damage type colors are defined in CardBase.vue: cosmic=purple, psychic=pink, necrotic=emerald, fire=orange, physical=yellow, magic=blue.

## Multiplayer Architecture
- **Firestore collection:** `crawlv2_games/{gameId}` — Authoritative game state. Status: lobby → active → finished.
- **Types:** `src/types/crawlv2-multiplayer.ts` — CrawlV2Game, GameAction, PendingReaction, PlayerInfo, DeckSelection.
- **Event enum:** `src/types/events.ts` — Shared Event enum extracted from EventBus. EventBus re-exports it.
- **Shared pure game logic:** `src/lib/crawlv2/` — buff-system, check-system, card-movement, damage-types, action-resolver. All take GameState as param (no Vue deps, no singleton). Composables are thin wrappers injecting getGameState().
- **Netlify functions:** `create-crawlv2`, `join-crawlv2`, `get-crawlv2-by-code`, `crawlv2-action`. The action function is self-contained (duplicates minimal types/logic to avoid tsconfig cross-project issues with nodenext moduleResolution).
- **Server-side buff/debuff rules:** The server `applyEffect` must replicate buff/debuff interaction rules (cursed blocks buffs, cleanse blocks debuffs, cursed clears all buffs on application) since the client-side EventBus system isn't available server-side. Any new buff/debuff interaction added to a client-side System must also be added to the server's `applyEffect` in `crawlv2-action.ts`.
- **Lobby flow:** Create game → 4-digit code → opponent joins → both select decks → ready up → server initializes GameState → status='active'.
- **Action model:** Client sends GameAction with actionId (UUID) to crawlv2-action. Server validates in Firestore transaction, applies, increments _version. Both clients subscribe via onSnapshot.
- **Reaction windows:** PendingReaction on game doc pauses attack resolution. Defending player responds with `react` action. Server resolves trap + original attack.
- **Idempotency:** processedActions[] ring buffer (last 50 actionIds) on game doc.
- **Turn enforcement:** Server checks callerUid → playerKey → currentPlayer. React actions allowed from respondingPlayer only.
- **Card visibility:** Phase 1 uses client-side filtering (not yet implemented). Full state in Firestore.
- **tsconfig:** Node tsconfig (netlify functions) uses skipLibCheck. Lib files use relative imports with .js extensions. App tsconfig handles @/ alias.

## Patterns
- Default unit effects are spread into card definitions: `...defaultUnitEffects`.
- New game mechanics are typically added as comparators in CheckSystem, then referenced declaratively in effect target/condition checks.
- The `equals` comparator uses `compareValues` which is typed as `number` but works with strings/booleans at runtime due to JS dynamic typing. This is used throughout for string comparisons like `location.type`, `race`, etc.
- Trap cards always include `setTrap` as their first effect, then their trigger effect.
- `spentOnUse: true` sends the card to the spent pile after effect resolution.
- `eventName` on an effect emits that event before the handler runs; if cancelled, the effect is aborted (used for TRAP_ACTIVATED, EFFECT_PLAYED etc. to allow counter-play).
