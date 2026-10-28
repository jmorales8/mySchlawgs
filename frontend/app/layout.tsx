import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import TutorialProvider from "./contexts/tutorial-context";
import AccountProvider from "./contexts/account-context";
import QueryProvider from "./contexts/query-context";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Script src="/theme-init.js" strategy="beforeInteractive" /><AccountProvider><QueryProvider><TutorialProvider>{children}</TutorialProvider></QueryProvider></AccountProvider></body>
    </html>
  );
}
