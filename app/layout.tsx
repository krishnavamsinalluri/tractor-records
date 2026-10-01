import type { Metadata, Viewport } from "next";
import { Noto_Sans_Telugu } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import TractorApp from "@/components/tractor-app";
import "./globals.css";

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ["latin", "telugu"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ట్రాక్టర్ లెక్కలు | Tractor Records",
  description: "ట్రాక్టర్ పని, చెల్లింపుల వివరాలు",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#166534",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="te" className={notoSansTelugu.className}>
      <body>
        <Suspense fallback={null}><TractorApp /></Suspense>
        {children}
      </body>
    </html>
  );
}
