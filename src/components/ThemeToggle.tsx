import { Moon, Sun } from "lucide-react";

import { Button } from "./ui/button";
import { useTheme } from "@/providers/theme-context";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
