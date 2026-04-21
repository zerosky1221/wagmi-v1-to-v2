// Type-only imports should sit next to value imports without breaking the
// rename. The `import type` form uses the same `import_specifier` shape, so
// the rename is identical — but these names aren't runtime calls.

import type { Config, Chain } from "wagmi";
import { useAccount } from "wagmi";

export function getChainId(cfg: Config, chain: Chain) {
  return chain.id ?? cfg.chains[0]?.id ?? useAccount().chainId;
}
