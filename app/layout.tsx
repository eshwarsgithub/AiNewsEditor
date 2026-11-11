import type { Metadata } from "next";
import { Anek_Telugu, Inter, Newsreader, Noto_Serif_Telugu } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["400", "600", "700"] });
const anek = Anek_Telugu({ variable: "--font-anek", subsets: ["latin", "telugu"], weight: ["400", "500", "600", "700"] });
const notoSerifTe = Noto_Serif_Telugu({
  variable: "--font-noto-serif-te",
  subsets: ["latin", "telugu"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AI News Editor",
  description: "Upload stories and photos; get a print-ready newspaper PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${anek.variable} ${notoSerifTe.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
