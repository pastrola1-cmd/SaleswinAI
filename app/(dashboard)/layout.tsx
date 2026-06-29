import { ProfileProvider } from "@/hooks/useProfile"
import DashboardShell from "./DashboardShell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProfileProvider>
      <DashboardShell>{children}</DashboardShell>
    </ProfileProvider>
  )
}
