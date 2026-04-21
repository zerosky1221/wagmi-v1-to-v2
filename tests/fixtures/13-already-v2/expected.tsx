// Idempotency: running the codemod on v2 code must produce zero edits.

import { useReadContract, useWriteContract, WagmiProvider } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

export const connectors = [injected(), walletConnect({ projectId: "abc" })];

export function Page({ children }: { children: React.ReactNode }) {
  const { data } = useReadContract({ address: "0x0", abi: [], functionName: "x" });
  const { writeContract } = useWriteContract();
  return (
    <WagmiProvider config={{} as any}>
      <button onClick={() => writeContract({} as any)}>{String(data)}</button>
      {children}
    </WagmiProvider>
  );
}
