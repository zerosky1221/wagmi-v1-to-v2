/**
 * Header doc block — must survive the transform verbatim.
 */
import { useReadContract, WagmiProvider } from "wagmi"; // inline comment on import

// Component comment
export function Widget() {
  // TODO: migrate to useReadContract
  const { data } = useReadContract({ address: "0x0", abi: [], functionName: "x" }); // trailing

  /* block comment before JSX */
  return <WagmiProvider config={{} as any}>{String(data)}</WagmiProvider>;
}
