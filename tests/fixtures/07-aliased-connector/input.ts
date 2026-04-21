// Aliased connector class must be left untouched — renaming the specifier
// while keeping the local `as Wallet` would break `new Wallet()` downstream
// (v2 connectors are functions, not classes). Defer to AI step.

import { InjectedConnector as Wallet } from "wagmi/connectors/injected";

export const wallet = new Wallet({ chains: [] } as any);
