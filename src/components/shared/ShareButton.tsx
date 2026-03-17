import { useState, useCallback } from "react";
import { Share2, Check } from "lucide-react";
import s from "./ShareButton.module.css";

interface ShareButtonProps {
  className?: string;
}

export function ShareButton({ className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <button
      type="button"
      className={`${s.shareBtn}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      title="Copy link to current view"
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      <span className={s.label}>{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
