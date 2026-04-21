// Aliased imports: the specifier name is renamed in place, but the local alias
// remains untouched so callers still compile.

import { useReadContract as readCtr, WagmiProvider as Root } from "wagmi";

export function App() {
  const { data } = readCtr({ address: "0x0", abi: [], functionName: "x" });
  return <Root config={{} as any}>{String(data)}</Root>;
}
