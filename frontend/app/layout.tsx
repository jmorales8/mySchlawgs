import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import TutorialProvider from "./contexts/tutorial-context";
import AccountProvider from "./contexts/account-context";
import QueryProvider from "./contexts/query-context";
import ThemeSync from "./components/shared/theme-sync";
import { isTheme, themeCookie, themeKey } from "./components/shared/theme-preference";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "mySchlawgs | The good dog gallery",
  description: "A growing photo roll of very good schlawgs.",
};

// Migrate an existing browser preference and fall back to the system on first visit.
const themeInit = `(() => {
  let theme;
  try { theme = localStorage.getItem(${JSON.stringify(themeKey)}); } catch {}
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") {
    if (root.dataset.theme !== theme) {
      document.cookie = theme === "dark" ? ${JSON.stringify(themeCookie("dark"))} : ${JSON.stringify(themeCookie("light"))};
    }
  } else {
    theme = root.dataset.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  root.dataset.theme = theme;
})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const savedTheme = (await cookies()).get(themeKey)?.value;
  return (
    <html
      lang="en"
      data-theme={isTheme(savedTheme) ? savedTheme : undefined}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{themeInit}</Script>
        <ThemeSync />
        <AccountProvider><QueryProvider><TutorialProvider>{children}</TutorialProvider></QueryProvider></AccountProvider>
      </body>
    </html>
  );
}
