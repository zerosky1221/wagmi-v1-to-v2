import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import { SafeConnector } from "wagmi/connectors/safe";

export const connectors = [
  new InjectedConnector(),
  new WalletConnectConnector({ options: { projectId: "abc" } }),
  new CoinbaseWalletConnector({ options: { appName: "MyApp" } }),
  new SafeConnector(),
];
