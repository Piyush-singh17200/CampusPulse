"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): ThemeChoice {
  const saved = localStorage.getItem("campuspulse-theme");
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
}

function getServerSnapshot(): ThemeChoice {
  return "system";
}

function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") {
    return;
  }

  if (choice === "system") {
    localStorage.removeItem("campuspulse-theme");
    document.documentElement.removeAttribute("data-theme");
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } else if (choice === "dark") {
    localStorage.setItem("campuspulse-theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
  } else {
    localStorage.setItem("campuspulse-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function handleSelect(choice: ThemeChoice) {
    applyTheme(choice);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => handleSelect("light")}
        aria-pressed={theme === "light"}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
          theme === "light"
            ? "border-forest bg-forest text-paper shadow-sm"
            : "border-line bg-paper text-ink hover:border-ink hover:bg-paper-dim"
        }`}
      >
        <Sun className="size-4" aria-hidden="true" />
        Light
      </button>

      <button
        type="button"
        onClick={() => handleSelect("dark")}
        aria-pressed={theme === "dark"}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
          theme === "dark"
            ? "border-forest bg-forest text-paper shadow-sm"
            : "border-line bg-paper text-ink hover:border-ink hover:bg-paper-dim"
        }`}
      >
        <Moon className="size-4" aria-hidden="true" />
        Dark
      </button>

      <button
        type="button"
        onClick={() => handleSelect("system")}
        aria-pressed={theme === "system"}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
          theme === "system"
            ? "border-forest bg-forest text-paper shadow-sm"
            : "border-line bg-paper text-ink hover:border-ink hover:bg-paper-dim"
        }`}
      >
        <Monitor className="size-4" aria-hidden="true" />
        System
      </button>
    </div>
  );
}
