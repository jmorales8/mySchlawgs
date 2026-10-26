"use client";

import { useTutorial } from "../../contexts/tutorial-context";

export function TutorialLink() {
  const open = useTutorial();
  return <a href="/how-it-works" aria-haspopup="dialog" onClick={event => { event.preventDefault(); open(); }}>How posts work</a>;
}
