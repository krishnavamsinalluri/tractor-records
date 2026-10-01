import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import TractorApp from "@/components/tractor-app";
import "./globals.css";

export const metadata: Metadata = {
  title: "ట్రాక్టర్ లెక్కలు | Tractor Records",
  description: "ట్రాక్టర్ పని, చెల్లింపుల వివరాలు",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="te">
      <body>
        <Suspense fallback={null}><TractorApp /></Suspense>
        {children}
      </body>
    </html>
  );
}
