import { ProfileProvider } from "@/hooks/useProfile"
import { ToastProvider } from "@/components/toast-provider"
import DashboardShell from "./DashboardShell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProfileProvider>
      <ToastProvider>
        <DashboardShell>{children}</DashboardShell>
      </ToastProvider>
    </ProfileProvider>
  )
}
