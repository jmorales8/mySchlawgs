"use client";

import { useEffect, useRef, useState } from "react";
import CommentComposer from "./comment-composer";

export default function CommentEditor({ body, reply, busy, onSave, onCancel }: {
  body: string; reply: boolean; busy: boolean;
  onSave: (body: string) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(body);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { textarea.current?.focus(); }, []);

  return <CommentComposer label={reply ? "Edit your reply" : "Edit your comment"}
    textareaRef={textarea} value={draft} onChange={setDraft} busy={busy} error={error}
    submitLabel="Save changes" pendingLabel="Saving…" cancelLabel="Cancel edit" onCancel={onCancel}
    onSubmit={async event => {
      event.preventDefault();
      if (busy || !draft.trim()) return;
      setError("");
      try { await onSave(draft); }
      catch (e) { setError((e as Error).message); }
    }} />;
}
