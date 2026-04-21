// Four connector classes from four subpath imports, consumed in a single
// array. MetaMaskConnector is deferred to the AI step (see fixture 06); the
// other three transform cleanly.

import { injected } from "wagmi/connectors";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";
import { walletConnect } from "wagmi/connectors";
import { safe } from "wagmi/connectors";

export const connectors = [
  injected(),
  new MetaMaskConnector(),
  walletConnect({ options: { projectId: "pid" } }),
  safe(),
];
