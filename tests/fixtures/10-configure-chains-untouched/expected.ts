// configureChains is a structural migration that the deterministic pass
// intentionally does NOT touch — the AI step handles the transports rewrite.
// This fixture locks in that behavior so a future regression can't silently
// half-transform this pattern.

import { configureChains, createConfig } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { mainnet, sepolia } from "wagmi/chains";

const { chains, publicClient } = configureChains([mainnet, sepolia], [publicProvider()]);

export const config = createConfig({ publicClient, chains });
