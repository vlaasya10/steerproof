import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SteerProof | Research with a paper trail",
  description: "Explore real research-to-content projects, source-linked claims, recorded reviews and generated assets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-cream text-ink min-h-screen antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
