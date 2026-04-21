/**
 * Header doc block — must survive the transform verbatim.
 */
import { useContractRead, WagmiConfig } from "wagmi"; // inline comment on import

// Component comment
export function Widget() {
  // TODO: migrate to useReadContract
  const { data } = useContractRead({ address: "0x0", abi: [], functionName: "x" }); // trailing

  /* block comment before JSX */
  return <WagmiConfig config={{} as any}>{String(data)}</WagmiConfig>;
}
