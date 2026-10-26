"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import TutorialDialog from "../components/tutorial/tutorial";

const TutorialContext = createContext<() => void>(() => {});

export const useTutorial = () => useContext(TutorialContext);

export default function TutorialProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openTutorial = useCallback(() => setOpen(true), []);
  const closeTutorial = useCallback(() => setOpen(false), []);

  return <TutorialContext.Provider value={openTutorial}>
    {children}
    {open && <TutorialDialog onClose={closeTutorial} />}
  </TutorialContext.Provider>;
}
