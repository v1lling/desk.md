export * from "./types";
export * from "./errors";
import { asSafeAgentReadError } from "./errors";
import { runDeskContext } from "./context";
import { runDeskCatalog } from "./catalog";
import { runDeskSearch } from "./search";
import { runDeskRead } from "./read";
import type {
  AgentCatalogQuery,
  AgentCatalogResult,
  AgentContextQuery,
  AgentContextResult,
  AgentReadQuery,
  AgentReadResult,
  AgentSearchQuery,
  AgentSearchResult,
} from "./types";

async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw asSafeAgentReadError(error);
  }
}

export function deskContextV2(query?: AgentContextQuery): Promise<AgentContextResult> {
  return safe(() => runDeskContext(query));
}

export function deskCatalogV2(query: AgentCatalogQuery): Promise<AgentCatalogResult> {
  return safe(() => runDeskCatalog(query));
}

export function deskSearchV2(query: AgentSearchQuery): Promise<AgentSearchResult> {
  return safe(() => runDeskSearch(query));
}

export function deskReadV2(query: AgentReadQuery): Promise<AgentReadResult> {
  return safe(() => runDeskRead(query));
}
