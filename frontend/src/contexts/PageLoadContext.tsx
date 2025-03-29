"use client";

import { createContext, useContext } from "react";

export interface PageLoadContextType {
  setPageLoaded: (loaded: boolean) => void;
}

export const PageLoadContext = createContext<PageLoadContextType>({
  setPageLoaded: () => {},
});

export const usePageLoadContext = () => useContext(PageLoadContext);