import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";

export type MedLibColors = typeof colors.light & { radius: number };

/**
 * Returns the design tokens for the current color scheme.
 *
 * Theme priority:
 * 1. User's explicit setting (light / dark) from SettingsContext
 * 2. System color scheme when setting is "system"
 * 3. Light palette as fallback
 */
export function useColors(): MedLibColors {
  const sysScheme = useColorScheme();
  let theme: "light" | "dark" = "light";
  try {
    const { settings } = useSettings();
    if (settings.theme === "dark") theme = "dark";
    else if (settings.theme === "light") theme = "light";
    else theme = sysScheme === "dark" ? "dark" : "light";
  } catch {
    theme = sysScheme === "dark" ? "dark" : "light";
  }
  const palette = theme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
