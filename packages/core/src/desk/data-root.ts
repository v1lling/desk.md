/**
 * Data-root seam.
 *
 * The domain resolves its data directory through this injectable resolver
 * instead of reaching into a UI store. The host wires it at boot:
 *   - app    → reads the boot store (`useBootStore.getState().dataPath`)
 *   - server → reads an env var (`DESK_DATA_ROOT`)
 * Default returns "~/Desk" so the domain is usable before wiring (dev/mock).
 *
 * Mirrors the storage/service registries (the set/get registry pattern).
 */
type DataRootResolver = () => Promise<string>;

let resolver: DataRootResolver = async () => "~/Desk";

export function setDataRootResolver(fn: DataRootResolver): void {
  resolver = fn;
}

export async function getDataRoot(): Promise<string> {
  return resolver();
}
