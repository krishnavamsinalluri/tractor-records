import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ట్రాక్టర్ లెక్కలు | Tractor Records",
  description: "ట్రాక్టర్ పని, చెల్లింపుల వివరాలు",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="te">
      <body>{children}</body>
    </html>
  );
}
