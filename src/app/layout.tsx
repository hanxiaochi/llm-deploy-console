import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Deploy Console",
  description: "A lightweight, auditable console for deploying GPU inference services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
