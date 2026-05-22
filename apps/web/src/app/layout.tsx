import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "資管所備考教練",
  description: "資管研究所考古題題庫 · 個人化弱點分析 · 題目價值排序",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${inter.className} bg-gray-50 text-gray-900 min-h-full`}>
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              資管所備考教練
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/questions" className="hover:text-blue-600 transition-colors">題庫</Link>
              <Link href="/analytics" className="hover:text-blue-600 transition-colors">弱點分析</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
