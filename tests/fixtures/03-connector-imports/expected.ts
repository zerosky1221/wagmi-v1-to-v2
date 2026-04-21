import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";
import { coinbaseWallet } from "wagmi/connectors";
import { safe } from "wagmi/connectors";

export const connectors = [
  injected(),
  walletConnect({ options: { projectId: "abc" } }),
  coinbaseWallet({ options: { appName: "MyApp" } }),
  safe(),
];
