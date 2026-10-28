import { lazy, type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Cursor from "./components/Cursor";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LeavePage = lazy(() => import("./pages/LeavePage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const HolidaysPage = lazy(() => import("./pages/HolidaysPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const WorkHubPage = lazy(() => import("./pages/WorkHubPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const OperationsPage = lazy(() => import("./pages/OperationsPage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const CorrectionsPage = lazy(() => import("./pages/CorrectionsPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const WorkFromHomePage = lazy(() => import("./pages/WorkFromHomePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

function Gate({ children, guest = false }: { children: ReactElement; guest?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (guest) return user ? <Navigate to="/dashboard" replace /> : children;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Cursor />
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<Gate guest><LoginPage /></Gate>} />
        <Route path="/change-password" element={<Gate><ChangePasswordPage /></Gate>} />
        <Route element={<Gate><Layout /></Gate>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/work-from-home" element={<WorkFromHomePage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/holidays" element={<HolidaysPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/work" element={<WorkHubPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/updates" element={<NotificationsPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/corrections" element={<CorrectionsPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
