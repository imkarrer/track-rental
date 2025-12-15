import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/session-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "RC Track Rental",
  description: "Rent RC car tracks and cars for your events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <SessionProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
