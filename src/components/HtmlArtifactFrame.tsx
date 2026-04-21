import { useEffect, useRef, useState } from "react";

interface Props { html: string; title?: string }

/** Sandboxed iframe that auto-resizes to its content height. */
export function HtmlArtifactFrame({ html, title = "Lumina Artifact" }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLoad = () => {
      try {
        const doc = el.contentDocument;
        if (!doc) return;
        const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
        setHeight(h + 20);
        // observe future changes
        const ro = new ResizeObserver(() => {
          const nh = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
          setHeight(nh + 20);
        });
        ro.observe(doc.body);
      } catch { /* cross-origin guard */ }
    };
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [html]);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      className="w-full rounded-2xl border border-border/30 bg-white"
      style={{ height }}
    />
  );
}
