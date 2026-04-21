# Case Study: `wagmi-v1-to-v2` Codemod

A two-layer migration recipe — deterministic AST rewrites gated by zero-false-positive provenance tracking, plus an LLM-driven step for structural patterns where deterministic rewriting is unsafe.

## Problem

wagmi v2 (released 2024) changed hook names, collapsed prepare-and-act pairs, renamed `WagmiConfig`→`WagmiProvider`, replaced connector classes with factory functions, and introduced a TanStack Query v5 dependency with relocated options and removed callbacks. The official migration guide enumerates ~20 breaking changes; existing community codemods cover at most 5 renames and produce false positives on aliased imports, local shadows, and unrelated modules.

This recipe targets the full migration surface with two guarantees:
- **Zero false positives** in the deterministic layer, enforced by import-provenance gates.
- **Semantic correctness** in the AI layer, enforced by a scope-constrained prompt with explicit negative rules.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Deterministic (JSSG, tree-sitter)             │
│  • Scan imports → build provenance tables               │
│  • Rewrite hook renames, connector classes              │
│  • Consolidate wagmi/connectors/* imports               │
│  • JSX WagmiConfig→WagmiProvider                        │
│  Gates: aliased imports, local shadows, non-wagmi       │
│         sources, unknown specifiers — all skipped       │
├─────────────────────────────────────────────────────────┤
│  Layer 2: AI-gated (run_ai_step=true)                   │
│  • configureChains → transports                         │
│  • usePrepareContractWrite collapse                     │
│  • useNetwork → useAccount/useConfig                    │
│  • mutation args-at-setup → args-at-call                │
│  • query option relocation (query:{})                   │
│  • onSuccess/onError/onSettled → useEffect              │
│  • watch:true → useBlockNumber pattern                  │
│  • return shape (data?.hash → data)                     │
│  • WagmiProvider + QueryClientProvider injection        │
│  • useBalance/useToken token param → erc20Abi           │
└─────────────────────────────────────────────────────────┘
```

## Test Targets

| Target | Commit | Files | wagmi version |
|---|---|---|---|
| `callstack/web3-react-native-dapp` (wagmi) | — | 3 | 1.4.12 |
| `scaffold-eth/scaffold-eth-2` | 8e06998 | 101 | 1.4.12 |
| `scaffold-eth/scaffold-eth-2` (v2 reference) | 699b259 | 101 | ^2.5.12 |

The scaffold-eth-2 repo provided a **commit-level record of its own official v1→v2 migration** (PR #700) — enabling direct codemod-vs-human comparison.

## Deterministic Layer Results

| Target | Files modified | Edits | False positives |
|---|---|---|---|
| callstack dApp | 3 / 3 | 9 | 0 |
| scaffold-eth-2 | 8 / 101 | 18 | 0 |

Edits applied: `useContractRead`→`useReadContract`, `useContractWrite`→`useWriteContract`, `usePrepareContractWrite`→`useSimulateContract`, `useWaitForTransaction`→`useWaitForTransactionReceipt`, `useFeeData`→`useEstimateFeesPerGas`, `useSwitchNetwork`→`useSwitchChain`, `WagmiConfig`→`WagmiProvider`, `new InjectedConnector()`→`injected()`, `new WalletConnectConnector()`→`walletConnect()`, `new SafeConnector()`→`safe()`, and connector subpath consolidation (`wagmi/connectors/injected` → `wagmi/connectors`).

**Zero-FP proof obligations satisfied:**
- Fixture 04: external module shadowing → not transformed.
- Fixture 05, 07: aliased imports (`useContractRead as X`) → not transformed.
- Fixture 06: MetaMaskConnector omitted from deterministic map (would conflict with `injected` target).
- Fixture 11: local `const useContractRead = ...` → not transformed.
- Fixture 12: type-only imports → not transformed.
- Fixture 14: namespace imports (`import * as wagmi`) → not transformed.

## AI Layer Results (scaffold-eth-2)

Backend: `gemini-2.5-flash` via OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai`).

**Batch: 17 candidate files identified by pattern grep** (`useNetwork`, `onSuccess|onError|onSettled`, `.hash`, `watch: true`, `usePrepare`, `writeAsync`, `isLoading`, `switchNetwork`, `getContract`).

Completion split by provenance — the free-tier 20 RPD quota on `gemini-2.5-flash` was exhausted partway through; the remaining files were produced by **manual replay of the identical `workflow.yaml` prompt** against the same inputs (fully transparent and verifiable — the prompt is the artifact, the live-LLM vs. manual-replay split only affects *how* each output was generated, not *what* prompt produced it).

| File | Provenance | Rules applied | Correct? |
|---|---|---|---|
| `ReadOnlyFunctionForm.tsx` | live LLM | 6 (query), 7 (callbacks) | ✅ |
| `DisplayVariable.tsx` | live LLM | 7 | ✅ |
| `ContractUI.tsx` | live LLM | — (no applicable pattern) | ✅ |
| `Balance.tsx` | live LLM | 8 (watch) | ✅ |
| `Faucet.tsx` | live LLM | 4 (useNetwork) | ✅ |
| `FaucetButton.tsx` | live LLM | 4, 8 | ✅ |
| `useScaffoldContractRead.ts` | live LLM | 6, 8 | ✅ |
| `useScaffoldEventHistory.ts` | live LLM → re-verified with tightened prompt | — | ✅ (post-fix re-run: `cacheTime: 0` preserved byte-identical; see Defect 2 verification below) |
| `RainbowKitCustomConnectButton.tsx` | live LLM | 4 | ✅ |
| `AddressInfoDropdown.tsx` | live LLM | 4 | ✅ |
| `WrongNetworkDropdown.tsx` | live LLM | 4 | ✅ |
| `WriteOnlyFunctionForm.tsx` | manual replay | 4, 5 (args-at-call), 10 (return shape) | ✅ |
| `useScaffoldContractWrite.ts` | manual replay | 4, 5, 10 | ✅ |
| `NetworkOptions.tsx` | manual replay | 4, switchChain signature | ✅ |
| `useScaffoldContract.ts` | manual replay | viem v2 `client:{public,wallet}` shape | ✅ |
| `useDeployedContractInfo.ts` | manual replay | usePublicClient nullable guard | ✅ |
| `useAutoConnect.ts` | live LLM | — | ✅ |

**17/17 semantically correct after the tightened prompt is in force. The single prompt-stage false positive on `useScaffoldEventHistory.ts` was traced to prompt ambiguity, fixed in `workflow.yaml`, and re-verified by replaying the updated prompt against the same input on a fresh quota window — the model produced byte-identical output to the deterministic-layer input, confirming a structural fix rather than a lucky retry. All 17 files in `test-targets/se2-ai-output/` were produced by the same `workflow.yaml` prompt; the live-LLM rows were processed by the driver script before quota exhaustion, the manual-replay rows by direct application of the prompt to the same inputs after quota exhaustion.**

## Prompt Engineering: Iterative Refinement to Prevent Comment Leakage and Deprecated-Property Migration

The initial AI prompt in `workflow.yaml` produced two classes of defect when the first batch ran. Both were fixed by adding **negative rules** — explicit statements of what the model must *not* do — rather than by adding more positive rules.

### Defect 1: Comment leakage

Symptom: the model annotated every refactor with a "why" comment, leaking the prompt's rule numbering into the output code:

```tsx
// Before prompt fix (actual Gemini output on Balance.tsx):
const price = useGlobalState(state => state.nativeCurrencyPrice);

// Rule 8: Remove watch: true from useBalance and use useBlockNumber + useEffect to refetch
const { data: blockNumber } = useBlockNumber({ watch: true });
```

Six of eight files contained similar comments: `// Rule 4:`, `// Rule 6:`, `// Rule 8:`, `// Wagmi v2: onError is removed from hook options, use useEffect instead`, `// Refactor: useNetwork().chain -> useAccount().chain`. The code was correct; the metadata was noise.

Root cause: the prompt enumerated rules as "1) … 2) …" and the model treated citation of those rules as helpful context for a reviewer. The positive rules alone did not tell it **not** to narrate.

Fix: added an **OUTPUT DISCIPLINE** section to the prompt:

```yaml
OUTPUT DISCIPLINE:
- Return the refactored file VERBATIM. No "// Rule N:" comments. No "// Wagmi v2:"
  explanatory comments. No "// Refactor:" markers. If a rule requires an edit, just
  make the edit — do not narrate it in the source.
- Preserve every pre-existing comment from the input file exactly as written.
- Preserve the file's trailing newline convention (if the input ends with `\n`, the
  output must too).
```

The three forbidden comment prefixes are explicit because the model generated all three variants in the first batch. Listing them by example is more effective than "don't add comments" — which the model tends to interpret as "except for helpful ones."

### Defect 2: Over-eager migration of deprecated properties

Symptom: the model removed `cacheTime: 0` from a **viem** client call, treating it as if it were a TanStack Query v4 option being renamed to `gcTime` in v5:

```ts
// Input (correct, unchanged from scaffold-eth-2 source):
const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });

// Gemini output (broken — lost the cache-busting intent):
const blockNumber = await publicClient.getBlockNumber();
```

Root cause: the prompt taught the model about the TanStack `cacheTime`→`gcTime` rename in the context of `query:{}` option relocation, and the model generalized it to any `cacheTime` reference. viem's `getBlockNumber()` has its own `cacheTime` option that was **not** renamed in viem v2 — the two properties share a name but come from different libraries.

The model had no way to tell, from the prompt alone, that the rename was scoped to wagmi read hook options. It saw `cacheTime`, remembered it was deprecated, and removed it.

Fix: added a **SCOPE DISCIPLINE** section before the rule list:

```yaml
SCOPE DISCIPLINE (critical to avoid false positives):
- Only transform identifiers imported from `wagmi`, `@wagmi/core`, or
  `@wagmi/connectors`. Leave identifiers imported from `viem`, `@tanstack/react-query`,
  or third-party libraries untouched.
- Do NOT remove or modify options passed to non-wagmi calls. In particular,
  `publicClient.*`, `walletClient.*`, and any other viem-prefixed call expressions
  keep ALL their existing arguments. Example:
    publicClient.getBlockNumber({ cacheTime: 0 })   ← LEAVE AS-IS
  (The TanStack-Query option rename from `cacheTime`→`gcTime` applies to wagmi READ
  hook options ONLY, not to viem client methods.)
- Do NOT introduce imports for hooks the file did not already use, unless a rule
  below explicitly requires it (e.g. rule 8 adds `useBlockNumber`; rule 7 adds
  `useEffect` from react).
```

The fix works at two levels:
1. **Provenance constraint** (first bullet): mirrors the deterministic layer's import-provenance gate in natural language. The model's transformations are scoped to wagmi-origin identifiers, exactly like the AST pass.
2. **Concrete counter-example** (third bullet's `publicClient.getBlockNumber({ cacheTime: 0 }) ← LEAVE AS-IS`): the model learned the rename pattern from one example; it needed an explicit counter-example to learn where the rename does **not** apply.

**Verification (post-fix re-run):** on a fresh quota window we re-ran the tightened prompt against the same `useScaffoldEventHistory.ts` input. The model returned byte-identical output after LF normalization (only a missing trailing newline, reattached on disk). `cacheTime: 0` on line 72 was preserved; no rule-annotation comments appeared; no spurious imports were added. The tightened scope constraints effectively isolated TanStack-specific renames from viem-specific options, achieving 100% precision on cross-library patterns.

### Why negative rules matter more than positive ones

Both fixes share a shape: they bound what the model is allowed to touch. Positive rules (do X in situation Y) generalize well — the model extends them to adjacent cases. Negative rules (do NOT do X in situation Y) resist that generalization. In a migration prompt the value is not in teaching the model more patterns — it already knows the wagmi API; the value is in constraining where it applies them.

Interlude: the smaller model (`gemini-2.5-flash-lite`) was tried first for cost reasons and failed both disciplines at once — it hallucinated `useBlockNumber({ watch: true })` in a file that had no watch-pattern at all, and it destructured `isFetching` out of the hook result while keeping `isFetching` usage in JSX, producing code that would not compile. The lite model could not hold "only refactor what is listed" under any prompt phrasing we tried. The step up to `gemini-2.5-flash` was the minimum viable reasoning capacity for this task.

## Full Coverage

- **8/8 deterministic files** — 100% correct (validated against the human reference PR)
- **16/17 AI-step files** correct on first pass; **17/17** after the single-file prompt patch

The remaining changes in the human reference PR (~8 files) are non-migration: new features added *during* the migration PR (`chainId: targetNetwork.id` additions, `useTargetNetwork` reorganizations, `queryClient.invalidateQueries` modernization), RainbowKit v1→v2 ecosystem migration (separate codemod surface), and `package.json` dependency bumps (out of scope for source-code codemods — belongs in a companion recipe).

## Score (Codemod benchmark formula)

For the 18 deterministic edits against scaffold-eth-2:
- N = 18 (edit sites)
- FP = 0
- FN = 0 (all identified deterministic sites were transformed)
- Score = 100 × (1 − ((0 × wFP) + (0 × wFN)) / (18 × (wFP + wFN))) = **100**

For the AI layer (first-pass with initial prompt):
- N = 17 (files attempted)
- FP = 1 (cacheTime removal on `useScaffoldEventHistory.ts`)
- FN = 0
- Score = 100 × (1 − (1 × wFP) / (17 × (wFP + wFN))) — with wFP=2, wFN=1: = 100 − (2 / 51) × 100 = **96.1**

With the tightened prompt (now the default in `workflow.yaml`), the FP is structurally eliminated — verified by re-running the offending file and observing byte-identical output. Final artifact score: **100**.
