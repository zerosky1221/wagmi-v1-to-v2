import { WagmiProvider, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";

const config = createConfig({ chains: [mainnet], transports: {} } as any);

export function App({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}
