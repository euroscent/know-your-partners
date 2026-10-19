import { LanguageProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import Index from "./pages/Index";
import Start from "./pages/Start";
import ServicesPage from "./pages/Services";
import IndustriesPage from "./pages/Industries";
import Partners from "./pages/Partners";
import Careers from "./pages/Careers";
import JobDetail from "./pages/JobDetail";
import FreelancerInfo from "./pages/FreelancerInfo";
import IconPicker from "./pages/IconPicker";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import Impressum from "./pages/Impressum";
import PaymentProviders from "./pages/industries/PaymentProviders";
import Banking from "./pages/industries/Banking";
import Crypto from "./pages/industries/Crypto";
import Marketplaces from "./pages/industries/Marketplaces";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import RegisterMinijob from "./pages/RegisterMinijob";
import RegisterTeilzeit from "./pages/RegisterTeilzeit";
import RegisterVollzeit from "./pages/RegisterVollzeit";
import RegisterFreelancer from "./pages/RegisterFreelancer";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Tasks from "./pages/Tasks";
import Library from "./pages/Library";
import TaskDetail from "./pages/TaskDetail";
import TaskDemoData from "./pages/TaskDemoData";
import ProductTest from "./pages/ProductTest";
import TaskQualityCheck from "./pages/TaskQualityCheck";
import TaskPostalDocumentsCheck from "./pages/TaskPostalDocumentsCheck";
import TaskSubmitted from "./pages/TaskSubmitted";
import Verification from "./pages/Verification";
import Application from "./pages/Application";
import ApplicantOnboarding from "./pages/ApplicantOnboarding";
import { ApplicantTaskGate } from "./components/ApplicantTaskGate";
import ApplicantVerifications from "./pages/admin/ApplicantVerifications";
import ApplicationSuccess from "./pages/ApplicationSuccess";
import AdminApplications from "./pages/AdminApplications";
import Employees from "./pages/admin/Employees";
import TaskReview from "./pages/admin/TaskReview";
import TaskManagement from "./pages/admin/TaskManagement";
import VideoChat from "./pages/admin/VideoChat";
import RequestCenter from "./pages/admin/RequestCenter";
import Completions from "./pages/admin/Completions";
import Contracts from "./pages/admin/Contracts";

import ContractEditor from "./pages/admin/ContractEditor";
import VirtualEmployees from "./pages/admin/VirtualEmployees";

import Settings from "./pages/Settings";
import EmployeeSettings from "./pages/EmployeeSettings";
import BouncingLogos from "./components/BouncingLogos";
import Payroll from "./pages/Payroll";
import FreelancerInvoices from "./pages/FreelancerInvoices";
import AdminPayouts from "./pages/admin/Payouts";
import AdminPayroll from "./pages/admin/Payroll";
import SubmissionsList from "./pages/admin/SubmissionsList";
import SubmissionReview from "./pages/admin/SubmissionReview";
import CreateEmployeeAccount from "./pages/admin/CreateEmployeeAccount";
import CouponManagement from "./pages/admin/CouponManagement";

import Presentation from "./pages/Presentation";
import Install from "./pages/Install";
import SecurityMonitoring from "./pages/admin/SecurityMonitoring";
import { MobileAppRouteGuard } from "./components/MobileAppRouteGuard";
import { AdminPinGate } from "./components/AdminPinGate";
import { AppSplashScreen } from "./components/AppSplashScreen";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <TooltipProvider>
      <BrowserRouter>
        <BouncingLogos />
        <AppSplashScreen />
        <MobileAppRouteGuard>
        <AdminPinGate>
        <AnimatedRoutes>
          <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Login />} />
           <Route path="/bewerbung" element={<Application />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
           <Route path="/dashboard/onboarding" element={<Dashboard />}>
             <Route index element={<ApplicantOnboarding />} />
           </Route>
           <Route path="/dashboard/admin/verifications" element={<Dashboard />}>
             <Route index element={<ApplicantVerifications />} />
           </Route>
          <Route path="/dashboard/documents" element={<Dashboard />}>
            <Route index element={<Documents />} />
          </Route>
          <Route path="/documents" element={<Navigate to="/dashboard/documents" replace />} />
          <Route path="/dashboard/tasks" element={<ApplicantTaskGate><Tasks /></ApplicantTaskGate>} />
          <Route path="/dashboard/library" element={<Dashboard />}>
            <Route index element={<Library />} />
          </Route>
           <Route path="/dashboard/tasks/:taskId" element={<ApplicantTaskGate><TaskDetail /></ApplicantTaskGate>} />
           <Route path="/dashboard/tasks/:taskId/demo-data" element={<ApplicantTaskGate><TaskDemoData /></ApplicantTaskGate>} />
           <Route path="/dashboard/tasks/:taskId/product-test" element={<ApplicantTaskGate><ProductTest /></ApplicantTaskGate>} />
           <Route path="/dashboard/tasks/:taskId/quality-check" element={<ApplicantTaskGate><TaskQualityCheck /></ApplicantTaskGate>} />
           <Route path="/dashboard/tasks/:taskId/postal-documents-check" element={<ApplicantTaskGate><TaskPostalDocumentsCheck /></ApplicantTaskGate>} />
          <Route path="/dashboard/tasks/:taskId/submitted" element={<TaskSubmitted />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/dashboard/verification" element={<Verification />} />
          <Route path="/dashboard/admin/applications" element={<Dashboard />}>
            <Route index element={<AdminApplications />} />
          </Route>
          <Route path="/dashboard/admin/employees" element={<Dashboard />}>
            <Route index element={<Employees />} />
          </Route>
          <Route path="/dashboard/admin/requests" element={<Dashboard />}>
            <Route index element={<RequestCenter />} />
          </Route>
          {/* Legacy routes - redirect to new combined page */}
          <Route path="/dashboard/admin/task-review" element={<Dashboard />}>
            <Route index element={<RequestCenter />} />
          </Route>
          <Route path="/dashboard/admin/video-chat" element={<Dashboard />}>
            <Route index element={<RequestCenter />} />
          </Route>
          <Route path="/dashboard/admin/task-management" element={<Dashboard />}>
            <Route index element={<TaskManagement />} />
          </Route>
          <Route path="/dashboard/admin/contracts" element={<Dashboard />}>
            <Route index element={<Contracts />} />
          </Route>
          <Route path="/dashboard/admin/virtual-employees" element={<Dashboard />}>
            <Route index element={<VirtualEmployees />} />
          </Route>
          <Route path="/dashboard/admin/payroll" element={<Dashboard />}>
            <Route index element={<AdminPayroll />} />
          </Route>
          <Route path="/dashboard/admin/payouts" element={<Dashboard />}>
            <Route index element={<AdminPayouts />} />
          </Route>
          <Route path="/dashboard/admin/submissions" element={<Dashboard />}>
            <Route index element={<SubmissionsList />} />
          </Route>
          <Route path="/dashboard/admin/create-user" element={<Dashboard />}>
            <Route index element={<CreateEmployeeAccount />} />
          </Route>
          <Route path="/dashboard/admin/coupons" element={<Dashboard />}>
            <Route index element={<CouponManagement />} />
          </Route>
          <Route path="/dashboard/admin/completions" element={<Dashboard />}>
            <Route index element={<Completions />} />
          </Route>
          <Route path="/admin/submissions/:submissionId" element={<SubmissionReview />} />
          <Route path="/dashboard/payroll" element={<Dashboard />}>
            <Route index element={<Payroll />} />
          </Route>
          <Route path="/dashboard/invoices" element={<Dashboard />}>
            <Route index element={<FreelancerInvoices />} />
          </Route>
          <Route path="/dashboard/admin/contract-editor/:id?" element={<ContractEditor />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/dashboard/employee-settings" element={<EmployeeSettings />} />
          <Route path="/dashboard/admin/security" element={<Dashboard />}>
            <Route index element={<SecurityMonitoring />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </AnimatedRoutes>
        </AdminPinGate>
        </MobileAppRouteGuard>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
