import { useContractRead, useContractReads, useContractWrite, useContractEvent, useWaitForTransaction, useFeeData, useSwitchNetwork } from "wagmi";

export function Balances() {
  const { data: balance } = useContractRead({
    address: "0x0",
    abi: [],
    functionName: "balanceOf",
  });

  const { data: reads } = useContractReads({ contracts: [] });
  const { writeAsync } = useContractWrite({ address: "0x0", abi: [], functionName: "x" });
  useContractEvent({ address: "0x0", abi: [], eventName: "Transfer", listener: () => {} });

  const { isLoading } = useWaitForTransaction({ hash: "0x0" });
  const { data: fee } = useFeeData();
  const { switchNetwork } = useSwitchNetwork();

  return null;
}
