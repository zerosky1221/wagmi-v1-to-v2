// A local function named exactly like a wagmi hook, with NO wagmi import at
// all. Nothing may be renamed — the codemod has zero signal this is wagmi.

function useContractRead() {
  return { data: 42 };
}

function InjectedConnector() {
  return { id: "local" };
}

export function Page() {
  const { data } = useContractRead();
  const c = new (InjectedConnector as any)();
  return <div>{data}{c.id}</div>;
}
