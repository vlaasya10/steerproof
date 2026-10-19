import type {ReactNode} from "react";
import {ReviewerProvider} from "@/components/ReviewerContext";
import {Navbar} from "@/components/Navbar";
import {ToastContainer} from "@/components/Toast";
import {WorkspaceAccess} from "@/components/WorkspaceAccess";
import {ProcessingNotice} from "@/components/ProcessingNotice";

export default function PrivateLayout({children}: {children: ReactNode}) {
  return <WorkspaceAccess><ReviewerProvider>
    <Navbar /><ProcessingNotice />
    <main className="flex-1">{children}</main><ToastContainer />
  </ReviewerProvider></WorkspaceAccess>;
}
