import { createContext, useContext, useState, type ReactNode } from 'react';

export type ViewKey = 'feed' | 'network' | 'messenger' | 'calendar' | 'admin' | 'profile';

interface UIState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  /** open a live stream viewer by id */
  openStreamId: string | null;
  setOpenStreamId: (id: string | null) => void;
  /** open the Go Live creator */
  goLiveOpen: boolean;
  setGoLiveOpen: (v: boolean) => void;
  /** open a DM thread from anywhere */
  openThreadId: string | null;
  setOpenThreadId: (id: string | null) => void;
  /** right sidebar collapsed on small screens */
  rightOpen: boolean;
  setRightOpen: (v: boolean) => void;
}

const UICtx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewKey>('feed');
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <UICtx.Provider
      value={{
        view,
        setView,
        openStreamId,
        setOpenStreamId,
        goLiveOpen,
        setGoLiveOpen,
        openThreadId,
        setOpenThreadId,
        rightOpen,
        setRightOpen,
      }}
    >
      {children}
    </UICtx.Provider>
  );
}

export function useUI(): UIState {
  const ctx = useContext(UICtx);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
