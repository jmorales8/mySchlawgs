"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { api } from "./api";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

export default function Captcha({ onChange }: { onChange: (token: string | null) => void }) {
  const [config, setConfig] = useState<{ enabled: boolean; siteKey: string | null } | null>(null);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    api<{ enabled: boolean; siteKey: string | null }>("/api/auth/captcha").then(result => {
      if (!active) return;
      setConfig(result);
      if (!result.enabled) onChange("");
    }).catch(() => { if (active) setError("Security check unavailable. Refresh the page to try again."); });
    return () => {
      active = false;
      if (widget.current !== null) { window.turnstile?.remove(widget.current); widget.current = null; }
    };
  }, [onChange]);

  function render() {
    if (!container.current || !window.turnstile || widget.current !== null || !config?.siteKey) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey: config.siteKey, action: "authentication", size: "flexible", theme: "light",
      callback: (token: string) => { setError(""); onChange(token); },
      "expired-callback": () => onChange(null),
      "error-callback": () => { onChange(null); setError("Security check failed to load. Check your connection and refresh to retry."); },
    });
  }

  return <div>
    {!config && !error && <p role="status">Loading security check…</p>}
    {config?.enabled && <>
      <div ref={container} />
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} onError={() => { onChange(null); setError("Security check unavailable. Refresh to retry."); }} />
    </>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
