// One import statement pulling a hook, the provider, an unchanged hook, and
// a utility — all in one specifier list. Every renamable name must land.

import {
  useReadContract,
  useAccount,
  WagmiProvider,
  useReadContracts,
  useConnect,
} from "wagmi";

export function Page() {
  const { address } = useAccount();
  const { data: one } = useReadContract({ address, abi: [], functionName: "f" });
  const { data: many } = useReadContracts({ contracts: [] });
  const { connect } = useConnect();

  return (
    <WagmiProvider config={{} as any}>
      <button onClick={() => connect({} as any)}>{String(one)}{String(many)}</button>
    </WagmiProvider>
  );
}
