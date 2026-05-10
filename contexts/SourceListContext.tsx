import React, { createContext, useCallback, useContext, useState } from "react";

export type SourceCarouselItem = {
  id: string;
  type: "video" | "article";
  kind?: "entry" | "book";
  title: string;
  subtitle?: string;
  thumbUrl?: string | null;
  videoUrl?: string | null;
  pdfUrl?: string | null;
};

type SourceListContextValue = {
  label: string;
  items: SourceCarouselItem[];
  setSource: (label: string, items: SourceCarouselItem[]) => void;
  clear: () => void;
};

const SourceListContext = createContext<SourceListContextValue | null>(null);

export function SourceListProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ label: string; items: SourceCarouselItem[] }>({
    label: "",
    items: [],
  });

  const setSource = useCallback((label: string, items: SourceCarouselItem[]) => {
    setState({ label, items });
  }, []);

  const clear = useCallback(() => {
    setState({ label: "", items: [] });
  }, []);

  return (
    <SourceListContext.Provider value={{ ...state, setSource, clear }}>
      {children}
    </SourceListContext.Provider>
  );
}

export function useSourceList(): SourceListContextValue {
  const ctx = useContext(SourceListContext);
  if (!ctx) throw new Error("useSourceList must be used inside SourceListProvider");
  return ctx;
}
