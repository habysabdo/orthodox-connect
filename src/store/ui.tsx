import { createContext, useContext, useState, type ReactNode } from 'react';

export type ViewKey = 'feed' | 'reels' | 'network' | 'messenger' | 'calendar' | 'admin' | 'profile';

interface UIState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  openStreamId: string | null;
  setOpenStreamId: (id: string | null) => void;
  goLiveOpen: boolean;
  setGoLiveOpen: (v: boolean) => void;
  openThreadId: string | null;
  setOpenThreadId: (id: string | null) => void;
  rightOpen: boolean;
  setRightOpen: (v: boolean) => void;
  /** video upload modal */
  uploadOpen: boolean;
  setUploadOpen: (v: boolean) => void;
  /** video call modal */
  callPeerId: string | null;
  setCallPeerId: (id: string | null) => void;
  callGroupLabel: string | null;
  setCallGroupLabel: (label: string | null) => void;
}

const UICtx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewKey>('feed');
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [rightOpen, setRightOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [callPeerId, setCallPeerId] = useState<string | null>(null);
  const [callGroupLabel, setCallGroupLabel] = useState<string | null>(null);

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
        uploadOpen,
        setUploadOpen,
        callPeerId,
        setCallPeerId,
        callGroupLabel,
        setCallGroupLabel,
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
