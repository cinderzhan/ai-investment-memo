import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DD Agent — Investment Memo Generator",
  description: "AI-powered investment memorandum generator for venture capital professionals. Upload pitch decks, generate structured memos, and refine with guided AI assistance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
