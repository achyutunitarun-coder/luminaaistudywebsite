import { useEffect } from "react";
import { THEME_LIST, type ThemeId } from "@/lib/luminaThemes";

interface Props {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}

export function ThemeSwitcher({ value, onChange }: Props) {
  useEffect(() => {
    document.documentElement.setAttribute("data-lumina-theme", value);
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      {THEME_LIST.map((t) => (
        <button
          key={t.id}
          aria-label={t.label}
          title={t.label}
          onClick={() => onChange(t.id)}
          className={`relative w-7 h-7 rounded-full transition-all duration-200 ${
            value === t.id ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-110"
          }`}
          style={{ background: t.swatch }}
        >
          {value === t.id && (
            <span className="absolute inset-0 rounded-full animate-pulse" style={{ boxShadow: `0 0 14px ${t.swatch}` }} />
          )}
        </button>
      ))}
    </div>
  );
}
