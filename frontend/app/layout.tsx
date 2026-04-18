import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Lighthouse OS — Humanitarian Intelligence",
  description: "UN-grade decision support platform for humanitarian funding gap analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text antialiased">
        <Sidebar />
        <main className="ml-[220px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
