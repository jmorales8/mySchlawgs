import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TutorialProvider from "./components/tutorial/tutorial";
import AccountProvider from "./components/account-provider";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AccountProvider><TutorialProvider>{children}</TutorialProvider></AccountProvider></body>
    </html>
  );
}
