import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://actionparity.com"),
  title: {
    default: "ActionParity（影核）— 一个动作，所有界面",
    template: "%s · ActionParity",
  },
  description:
    "影核（ActionParity）是面向 AI 时代的动作同源开放标准，让 GUI、CLI、MCP、API 与测试共同调用一个 Action Core。",
  keywords: [
    "ActionParity",
    "影核",
    "ShadowCore protocol",
    "Action Core",
    "AI Native",
    "MCP",
  ],
  authors: [{ name: "ActionParity Contributors" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: "ActionParity（影核）",
    title: "ActionParity（影核）— 一个动作，所有界面",
    description: "GUI、CLI、MCP、API 与测试，共同调用一个 Action Core。",
  },
  twitter: {
    card: "summary_large_image",
    title: "ActionParity（影核）— 一个动作，所有界面",
    description: "GUI、CLI、MCP、API 与测试，共同调用一个 Action Core。",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
