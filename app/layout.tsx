import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent Museum — draw for the AI Curator",
  description: "Every 5 minutes an AI curator commissions art. Draw it by hand. The winner gets hung in the museum and paid in SOL.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <nav className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-sm border border-[var(--gold)] font-serif text-lg text-[var(--gold)]">A</span>
              <span className="font-serif text-xl tracking-wide">Agent Museum</span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-white/5">
                Studio
              </Link>
              <Link href="/museum" className="rounded-md px-3 py-1.5 hover:bg-white/5">
                Museum
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
