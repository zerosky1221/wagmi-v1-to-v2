/**
 * Zero-FP policy: only rewrite identifiers that are provably imported from
 * `wagmi` or `wagmi/connectors/*` in this file. Never touch a symbol that
 * shadows a wagmi name but originates elsewhere.
 */
const HOOK_RENAMES = {
    useContractRead: "useReadContract",
    useContractReads: "useReadContracts",
    useContractWrite: "useWriteContract",
    useContractInfiniteReads: "useInfiniteReadContracts",
    useContractEvent: "useWatchContractEvent",
    usePrepareContractWrite: "useSimulateContract",
    usePrepareSendTransaction: "useEstimateGas",
    useWaitForTransaction: "useWaitForTransactionReceipt",
    useFeeData: "useEstimateFeesPerGas",
    useSwitchNetwork: "useSwitchChain",
};
const JSX_RENAMES = {
    WagmiConfig: "WagmiProvider",
};
// MetaMaskConnector is intentionally omitted — collapsing `new MetaMaskConnector()`
// into `injected({ target: "metaMask" })` would collide with a plain
// `InjectedConnector` in the same file (two identical imports, duplicate binding)
// and requires arg-mutation the codemod cannot perform safely. Defer to AI.
const CONNECTOR_CLASS_TO_FN = {
    InjectedConnector: { fn: "injected" },
    WalletConnectConnector: { fn: "walletConnect" },
    CoinbaseWalletConnector: { fn: "coinbaseWallet" },
    SafeConnector: { fn: "safe" },
    LedgerConnector: { fn: "ledger" },
};
const CONNECTOR_SUBPATH_RE = /^wagmi\/connectors\/[A-Za-z0-9_-]+$/;
function stripQuotes(s) {
    if (!s)
        return s;
    const first = s.charAt(0);
    if ((first === '"' || first === "'" || first === "`") && s.endsWith(first)) {
        return s.slice(1, -1);
    }
    return s;
}
const codemod = async (root) => {
    const rootNode = root.root();
    const edits = [];
    // ----- Pass 1: scan imports, build provenance tables -----
    // localName -> originalName imported from wagmi (handles `import { useAccount as wAcct }`)
    const wagmiLocalToOriginal = new Map();
    // localName -> originalName for connector imports (from 'wagmi/connectors' or subpaths)
    const connectorLocalToOriginal = new Map();
    // import_statement nodes that import from wagmi/connectors/* (need path consolidation)
    const connectorSubpathImports = [];
    // import_statement nodes that import from 'wagmi' (for adding named imports later, if needed)
    const wagmiMainImports = [];
    const importStmts = rootNode.findAll({ rule: { kind: "import_statement" } });
    for (const imp of importStmts) {
        const sourceNode = imp.find({
            rule: { kind: "string", inside: { kind: "import_statement" } },
        });
        if (!sourceNode)
            continue;
        const src = stripQuotes(sourceNode.text());
        if (!src)
            continue;
        const isMainWagmi = src === "wagmi";
        const isConnectorSubpath = CONNECTOR_SUBPATH_RE.test(src);
        const isConnectorsRoot = src === "wagmi/connectors";
        if (!isMainWagmi && !isConnectorSubpath && !isConnectorsRoot)
            continue;
        if (isMainWagmi)
            wagmiMainImports.push(imp);
        if (isConnectorSubpath)
            connectorSubpathImports.push(imp);
        const specs = imp.findAll({ rule: { kind: "import_specifier" } });
        for (const s of specs) {
            const nameNode = s.field("name");
            const aliasNode = s.field("alias");
            if (!nameNode)
                continue;
            const original = nameNode.text();
            const local = aliasNode ? aliasNode.text() : original;
            if (isMainWagmi) {
                wagmiLocalToOriginal.set(local, original);
            }
            else if (isConnectorSubpath || isConnectorsRoot) {
                connectorLocalToOriginal.set(local, original);
            }
        }
    }
    // ----- Pass 2: rewrite import specifiers on main `wagmi` imports -----
    // Rename `useContractRead` → `useReadContract` etc. inside the specifier list.
    for (const imp of wagmiMainImports) {
        const specs = imp.findAll({ rule: { kind: "import_specifier" } });
        for (const s of specs) {
            const nameNode = s.field("name");
            if (!nameNode)
                continue;
            const original = nameNode.text();
            if (HOOK_RENAMES[original]) {
                // Replace the name identifier token only; preserve `as alias` part.
                const r = nameNode.range();
                edits.push({
                    startPos: r.start.index,
                    endPos: r.end.index,
                    insertedText: HOOK_RENAMES[original],
                });
            }
            else if (JSX_RENAMES[original]) {
                const r = nameNode.range();
                edits.push({
                    startPos: r.start.index,
                    endPos: r.end.index,
                    insertedText: JSX_RENAMES[original],
                });
            }
        }
    }
    // ----- Pass 3: consolidate connector subpath imports into `wagmi/connectors` -----
    // `import { InjectedConnector } from 'wagmi/connectors/injected'`
    //   → `import { injected } from 'wagmi/connectors'`
    // Preserves `as alias` form.
    for (const imp of connectorSubpathImports) {
        const sourceNode = imp.find({
            rule: { kind: "string", inside: { kind: "import_statement" } },
        });
        if (!sourceNode)
            continue;
        // Zero-FP gate — skip the ENTIRE statement if:
        //  (a) any specifier is aliased (keeping `as Wallet` would desync the
        //      `new Wallet()` call site; see fixture 07), OR
        //  (b) any specifier name is not in the class→fn map (rewriting the
        //      source path alone would leave dangling names pointing at
        //      identifiers that don't exist under `wagmi/connectors`).
        const specs = imp.findAll({ rule: { kind: "import_specifier" } });
        const hasAlias = specs.some((s) => s.field("alias") != null);
        if (hasAlias)
            continue;
        const allMappable = specs.every((s) => {
            const nameNode = s.field("name");
            if (!nameNode)
                return false;
            return CONNECTOR_CLASS_TO_FN[nameNode.text()] != null;
        });
        if (!allMappable)
            continue;
        // Rewrite source path
        const sr = sourceNode.range();
        edits.push({
            startPos: sr.start.index,
            endPos: sr.end.index,
            insertedText: `"wagmi/connectors"`,
        });
        // Rewrite each specifier's name from ClassName to functionName
        for (const s of specs) {
            const nameNode = s.field("name");
            if (!nameNode)
                continue;
            const original = nameNode.text();
            const mapped = CONNECTOR_CLASS_TO_FN[original];
            if (!mapped)
                continue;
            const nr = nameNode.range();
            edits.push({
                startPos: nr.start.index,
                endPos: nr.end.index,
                insertedText: mapped.fn,
            });
        }
    }
    // ----- Pass 4: rename hook call sites (only wagmi-sourced identifiers) -----
    // Targets: `call_expression` whose `function` field is an `identifier`
    // matching a wagmi-imported local name whose original is in HOOK_RENAMES.
    const callExprs = rootNode.findAll({ rule: { kind: "call_expression" } });
    for (const ce of callExprs) {
        const fn = ce.field("function");
        if (!fn || fn.kind() !== "identifier")
            continue;
        const local = fn.text();
        const original = wagmiLocalToOriginal.get(local);
        if (!original)
            continue;
        const mapped = HOOK_RENAMES[original];
        if (!mapped)
            continue;
        // If the user aliased the import, we must not rename the local usage — the
        // import specifier rename already handles `import { useContractRead as X }`
        // by only touching the `name` half; local `X(...)` stays intact. We only
        // rewrite when local === original.
        if (local !== original)
            continue;
        const r = fn.range();
        edits.push({
            startPos: r.start.index,
            endPos: r.end.index,
            insertedText: mapped,
        });
    }
    // ----- Pass 5: convert `new XxxConnector(args)` → `xxx(args)` -----
    // Gated by: identifier was imported from a wagmi connector source.
    const newExprs = rootNode.findAll({ rule: { kind: "new_expression" } });
    for (const ne of newExprs) {
        const ctor = ne.field("constructor");
        if (!ctor || ctor.kind() !== "identifier")
            continue;
        const local = ctor.text();
        const original = connectorLocalToOriginal.get(local);
        if (!original)
            continue;
        const mapped = CONNECTOR_CLASS_TO_FN[original];
        if (!mapped)
            continue;
        // Only transform when local === original. Aliased forms get AI treatment.
        if (local !== original)
            continue;
        const neRange = ne.range();
        const ctorRange = ctor.range();
        // Drop `new ` (from neRange.start up to ctor.start) and rename the
        // identifier. Argument list is preserved verbatim; any option-shape drift
        // (e.g. WalletConnect's `{ options: { projectId } }` → `{ projectId }`) is
        // left for the AI step so the deterministic pass never silently reshapes
        // user-authored argument objects.
        edits.push({
            startPos: neRange.start.index,
            endPos: ctorRange.start.index,
            insertedText: "",
        });
        edits.push({
            startPos: ctorRange.start.index,
            endPos: ctorRange.end.index,
            insertedText: mapped.fn,
        });
    }
    // ----- Pass 6: JSX rename `<WagmiConfig>` → `<WagmiProvider>` -----
    // Gated by local name resolving to an original wagmi import of WagmiConfig.
    // JSX passes only run under a grammar that knows JSX (tsx/jsx). Under pure
    // typescript/javascript, these node kinds don't exist — swallow the rule
    // error and move on.
    const renameJsxTag = (nameNode) => {
        if (!nameNode || nameNode.kind() !== "identifier")
            return;
        const local = nameNode.text();
        const original = wagmiLocalToOriginal.get(local);
        if (!original)
            return;
        const mapped = JSX_RENAMES[original];
        if (!mapped)
            return;
        if (local !== original)
            return; // aliased → skip
        const r = nameNode.range();
        edits.push({
            startPos: r.start.index,
            endPos: r.end.index,
            insertedText: mapped,
        });
    };
    const safeFindAll = (kind) => {
        try {
            return rootNode.findAll({ rule: { kind } });
        }
        catch {
            return [];
        }
    };
    for (const el of safeFindAll("jsx_opening_element"))
        renameJsxTag(el.field("name"));
    for (const el of safeFindAll("jsx_closing_element"))
        renameJsxTag(el.field("name"));
    for (const el of safeFindAll("jsx_self_closing_element"))
        renameJsxTag(el.field("name"));
    return rootNode.commitEdits(edits);
};
export default codemod;
