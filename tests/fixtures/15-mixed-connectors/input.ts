// Four connector classes from four subpath imports, consumed in a single
// array. MetaMaskConnector is deferred to the AI step (see fixture 06); the
// other three transform cleanly.

import { InjectedConnector } from "wagmi/connectors/injected";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { SafeConnector } from "wagmi/connectors/safe";

export const connectors = [
  new InjectedConnector(),
  new MetaMaskConnector(),
  new WalletConnectConnector({ options: { projectId: "pid" } }),
  new SafeConnector(),
];
