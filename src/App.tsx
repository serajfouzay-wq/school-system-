import { useEffect, useState } from 'react'
import { useApp } from '@/store/app'
import { AppShell } from '@/layouts/AppShell'
import { Toasts, Loading } from '@/components/ui/Feedback'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { SetupWizard } from '@/features/setup/SetupWizard'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { StudentsPage } from '@/features/students/StudentsPage'
import { StudentProfilePage } from '@/features/students/StudentProfilePage'
import { StaffPage } from '@/features/staff/StaffPage'
import { StaffProfilePage } from '@/features/staff/StaffProfilePage'
import { AttendancePage } from '@/features/attendance/AttendancePage'
import { TimetablePage } from '@/features/timetable/TimetablePage'
import { GradesPage } from '@/features/grades/GradesPage'
import { FeesPage } from '@/features/fees/FeesPage'
import { AcademicsPage } from '@/features/academics/AcademicsPage'
import { AnnouncementsPage } from '@/features/communication/AnnouncementsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { RecycleBinPage } from '@/features/recycle/RecycleBinPage'
import { HelpPage } from '@/features/help/HelpPage'

export default function App() {
  const ready = useApp((s) => s.ready)
  const boot = useApp((s) => s.boot)
  const school = useApp((s) => s.school)
  const user = useApp((s) => s.user)
  const screen = useApp((s) => s.screen)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    boot().catch((e: Error) => setBootError(e.message))
  }, [boot])

  if (bootError) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Could not start</h1>
          <p className="text-ink-500">{bootError}</p>
        </div>
      </div>
    )
  }

  if (!ready) return <Loading />

  // Order matters: setup first, then sign-in, then the app itself.
  if (!school || school.setup_complete !== 1) {
    return (
      <>
        <SetupWizard onDone={() => void boot()} />
        <Toasts />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <Toasts />
      </>
    )
  }

  return (
    <>
      <AppShell>{renderScreen(screen)}</AppShell>
      <Toasts />
    </>
  )
}

function renderScreen(screen: ReturnType<typeof useApp.getState>['screen']) {
  switch (screen.name) {
    case 'dashboard': return <DashboardPage />
    case 'students': return <StudentsPage />
    case 'studentProfile': return <StudentProfilePage id={screen.id} />
    case 'staff': return <StaffPage />
    case 'staffProfile': return <StaffProfilePage id={screen.id} />
    case 'attendance': return <AttendancePage />
    case 'timetable': return <TimetablePage />
    case 'grades': return <GradesPage />
    case 'fees': return <FeesPage />
    case 'classes': return <AcademicsPage />
    case 'announcements': return <AnnouncementsPage />
    case 'calendar': return <AnnouncementsPage />
    case 'reports': return <ReportsPage />
    case 'settings': return <SettingsPage />
    case 'recycleBin': return <RecycleBinPage />
    case 'help': return <HelpPage />
    default: return <DashboardPage />
  }
}
