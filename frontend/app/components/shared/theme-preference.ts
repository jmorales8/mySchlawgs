export const themeKey = "myschlawgs-theme";
export const themeChangeEvent = "myschlawgs-theme-change";

export function isTheme(value: unknown): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

export function themeCookie(theme: "light" | "dark" | null) {
  return `${themeKey}=${theme ?? ""}; Path=/; Max-Age=${theme ? 31536000 : 0}; SameSite=Lax`;
}
