// MetaMaskConnector is deferred to the AI step. Collapsing it into
// `injected({ target: "metaMask" })` at the connector site while also having a
// plain `InjectedConnector` elsewhere in the codebase would produce a duplicate
// `import { injected }` binding. The AI step handles this safely by merging /
// deduping the imports together with any bespoke options the user passed.

import { MetaMaskConnector } from "wagmi/connectors/metaMask";

export const connectors = [new MetaMaskConnector()];
