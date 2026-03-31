import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface TabDataContextValue {
  tabData: unknown;
  setTabData: (data: unknown) => void;
}

const TabDataContext = createContext<TabDataContextValue>({
  tabData: undefined,
  setTabData: () => {},
});

export function TabDataProvider({ children }: { children: ReactNode }) {
  const [tabData, setTabDataState] = useState<unknown>(undefined);
  const setTabData = useCallback((data: unknown) => setTabDataState(data), []);
  return (
    <TabDataContext.Provider value={{ tabData, setTabData }}>
      {children}
    </TabDataContext.Provider>
  );
}

export function useTabData() { return useContext(TabDataContext); }

// Hook for pages to publish their data
export function usePublishTabData(data: unknown) {
  const { setTabData } = useTabData();
  // Update whenever data changes
  useState(() => { setTabData(data); });
  const update = useCallback(() => setTabData(data), [data, setTabData]);
  return update;
}
