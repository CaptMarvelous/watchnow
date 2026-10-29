"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Status } from "@/lib/library/constants";

/**
 * What the browsing UI needs to know about the signed-in user's library: just
 * "kind:id" -> status, so every card can show a badge without its own query.
 * The server re-renders this after each change (revalidatePath on "/" layout).
 */
type Value = { signedIn: boolean; index: Record<string, Status> };

const LibraryContext = createContext<Value>({ signedIn: false, index: {} });

export function LibraryProvider({ value, children }: { value: Value; children: ReactNode }) {
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): Value {
  return useContext(LibraryContext);
}
