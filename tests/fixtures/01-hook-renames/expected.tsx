import { useReadContract, useReadContracts, useWriteContract, useWatchContractEvent, useWaitForTransactionReceipt, useEstimateFeesPerGas, useSwitchChain } from "wagmi";

export function Balances() {
  const { data: balance } = useReadContract({
    address: "0x0",
    abi: [],
    functionName: "balanceOf",
  });

  const { data: reads } = useReadContracts({ contracts: [] });
  const { writeAsync } = useWriteContract({ address: "0x0", abi: [], functionName: "x" });
  useWatchContractEvent({ address: "0x0", abi: [], eventName: "Transfer", listener: () => {} });

  const { isLoading } = useWaitForTransactionReceipt({ hash: "0x0" });
  const { data: fee } = useEstimateFeesPerGas();
  const { switchNetwork } = useSwitchChain();

  return null;
}
