import type { Metadata } from "next";
import "./globals.css";
import { ReviewerProvider } from "@/components/ReviewerContext";
import { Navbar } from "@/components/Navbar";
import { ToastContainer } from "@/components/Toast";
import { WorkspaceAccess } from "@/components/WorkspaceAccess";
import { ProcessingNotice } from "@/components/ProcessingNotice";

export const metadata: Metadata = {
  title: "SteerProof | Clinical Evidence Verification",
  description: "Doctor-led metabolic evidence verification and social publishing suite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-cream text-ink min-h-screen antialiased flex flex-col">
        <WorkspaceAccess><ReviewerProvider>
          <Navbar />
          <ProcessingNotice />
          <main className="flex-1">{children}</main>
          <ToastContainer />
        </ReviewerProvider></WorkspaceAccess>
      </body>
    </html>
  );
}
