// Guard test: identifiers that look like wagmi hooks but come from other modules
// must NOT be renamed. This exercises the provenance gate.

import { useContractRead } from "./my-local-hooks";
import { WagmiConfig } from "./branding";
import { InjectedConnector } from "./walletkit";

export function Page() {
  const { data } = useContractRead();
  const cls = new InjectedConnector();
  return <WagmiConfig>{cls.name}</WagmiConfig>;
}
