/**
 * Which "How this works" panels were already shown in this session. Kept in memory only: it is
 * gone when the page is reloaded. A panel opens by itself the first time its screen appears and
 * stays closed afterwards (the button opens it again).
 */
import { createContext, useContext, useRef, type ReactNode } from "react";

const HelpSeenContext = createContext<Set<string>>(new Set());

export function HelpSessionProvider({ children }: { children: ReactNode }) {
  const seen = useRef<Set<string>>(new Set());
  return <HelpSeenContext.Provider value={seen.current}>{children}</HelpSeenContext.Provider>;
}

export function useHelpSeen(): Set<string> {
  return useContext(HelpSeenContext);
}
