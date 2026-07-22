import { useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(isDarkMode);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="cursor-pointer rounded-md border border-border bg-muted/40 p-1.5 text-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      {isDark ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
    </button>
  );
}
