// One import statement pulling a hook, the provider, an unchanged hook, and
// a utility — all in one specifier list. Every renamable name must land.

import {
  useContractRead,
  useAccount,
  WagmiConfig,
  useContractReads,
  useConnect,
} from "wagmi";

export function Page() {
  const { address } = useAccount();
  const { data: one } = useContractRead({ address, abi: [], functionName: "f" });
  const { data: many } = useContractReads({ contracts: [] });
  const { connect } = useConnect();

  return (
    <WagmiConfig config={{} as any}>
      <button onClick={() => connect({} as any)}>{String(one)}{String(many)}</button>
    </WagmiConfig>
  );
}
