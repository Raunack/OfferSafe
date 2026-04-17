import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OfferSafe",
  description: "Scam risk analyzer for job and internship offers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>
        <header style={{ background: "var(--navbar-bg)", color: "var(--navbar-text)" }}>
          <div className="container-page" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="text-xl font-bold tracking-tight">
                OfferSafe
              </Link>
              <nav className="flex flex-wrap items-center gap-5 text-sm font-medium" style={{ color: "var(--footer-text)" }}>
                <Link href="/scam-cases" className="hover:text-white">
                  Reports
                </Link>
                <Link href="/report-a-scam" className="hover:text-white">
                  Report a scam
                </Link>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
                <Link href="/admin-offersafe" className="hover:text-white">
                  Admin
                </Link>
                <Link
                  href="/analyze"
                  className="inline-flex items-center rounded"
                  style={{ background: "#ffffff", color: "var(--navbar-bg)", padding: "8px 14px", borderRadius: 4, fontWeight: 600 }}
                >
                  Analyze
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="container-page">{children}</main>
        <footer style={{ background: "var(--footer-bg)", color: "var(--footer-text)", marginTop: 24 }}>
          <div className="container-page" style={{ paddingTop: 28, paddingBottom: 18 }}>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-lg font-bold" style={{ color: "var(--navbar-text)" }}>
                  OfferSafe
                </p>
                <p className="text-sm">Helping students and job-seekers detect suspicious offers before they commit.</p>
                <p className="mt-2 text-sm">Contact: offersafe.india@gmail.com</p>
              </div>
              <div className="flex flex-col gap-2 text-sm sm:items-end">
                <Link href="/scam-cases" className="hover:text-white">
                  Reports
                </Link>
                <Link href="/analyze" className="hover:text-white">
                  Analyze
                </Link>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
                <Link href="/admin-offersafe" className="hover:text-white">
                  Admin
                </Link>
              </div>
            </div>
            <div className="mt-6 border-t pt-3 text-sm" style={{ borderColor: "#30304a", fontSize: 14 }}>
              © 2025 OfferSafe. Not legal advice. For awareness only.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}