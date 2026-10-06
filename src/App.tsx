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
import ApplicationSuccess from "./pages/ApplicationSuccess";
import AdminApplications from "./pages/AdminApplications";
import Employees from "./pages/admin/Employees";
import TaskReview from "./pages/admin/TaskReview";
import TaskManagement from "./pages/admin/TaskManagement";
import VideoChat from "./pages/admin/VideoChat";
import RequestCenter from "./pages/admin/RequestCenter";
import Completions from "./pages/admin/Completions";
import Contracts from "./pages/admin/Contracts";
import PhoneNumbers from "./pages/admin/PhoneNumbers";

import ContractEditor from "./pages/admin/ContractEditor";
import ChatInbox from "./pages/admin/ChatInbox";
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
import EmailSender from "./pages/admin/EmailSender";
import CouponManagement from "./pages/admin/CouponManagement";
import TempMailInbox from "./pages/admin/TempMailInbox";
import DataExport from "./pages/admin/DataExport";

import Presentation from "./pages/Presentation";
import Install from "./pages/Install";
import SecurityMonitoring from "./pages/admin/SecurityMonitoring";
import { MobileAppRouteGuard } from "./components/MobileAppRouteGuard";
import { AdminPgpGate } from "./components/AdminPgpGate";
import { AppSplashScreen } from "./components/AppSplashScreen";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <BouncingLogos />
        <AppSplashScreen />
        <MobileAppRouteGuard>
        <AdminPgpGate>
        <AnimatedRoutes>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/start" element={<Start />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/minijob" element={<RegisterMinijob />} />
          <Route path="/register/teilzeit" element={<RegisterTeilzeit />} />
          <Route path="/register/vollzeit" element={<RegisterVollzeit />} />
          <Route path="/register/freelancer" element={<RegisterFreelancer />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/documents" element={<Dashboard />}>
            <Route index element={<Documents />} />
          </Route>
          <Route path="/documents" element={<Navigate to="/dashboard/documents" replace />} />
          <Route path="/dashboard/tasks" element={<Tasks />} />
          <Route path="/dashboard/library" element={<Dashboard />}>
            <Route index element={<Library />} />
          </Route>
           <Route path="/dashboard/tasks/:taskId" element={<TaskDetail />} />
           <Route path="/dashboard/tasks/:taskId/demo-data" element={<TaskDemoData />} />
           <Route path="/dashboard/tasks/:taskId/product-test" element={<ProductTest />} />
           <Route path="/dashboard/tasks/:taskId/quality-check" element={<TaskQualityCheck />} />
           <Route path="/dashboard/tasks/:taskId/postal-documents-check" element={<TaskPostalDocumentsCheck />} />
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
          <Route path="/dashboard/admin/phone-numbers" element={<Dashboard />}>
            <Route index element={<PhoneNumbers />} />
          </Route>
          <Route path="/dashboard/admin/chat-inbox" element={<Dashboard />}>
            <Route index element={<ChatInbox />} />
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
          <Route path="/dashboard/admin/email-sender" element={<Dashboard />}>
            <Route index element={<EmailSender />} />
          </Route>
          <Route path="/dashboard/admin/coupons" element={<Dashboard />}>
            <Route index element={<CouponManagement />} />
          </Route>
          <Route path="/dashboard/admin/completions" element={<Dashboard />}>
            <Route index element={<Completions />} />
          </Route>
          <Route path="/dashboard/admin/temp-mail" element={<Dashboard />}>
            <Route index element={<TempMailInbox />} />
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
          <Route path="/application" element={<Application />} />
          <Route path="/application/success" element={<ApplicationSuccess />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/industries" element={<IndustriesPage />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/careers/freelancer-info" element={<FreelancerInfo />} />
          <Route path="/careers/:jobId" element={<JobDetail />} />
          <Route path="/icon-picker" element={<IconPicker />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/industries/payment-providers" element={<PaymentProviders />} />
          <Route path="/industries/banking" element={<Banking />} />
          <Route path="/industries/crypto" element={<Crypto />} />
          <Route path="/industries/marketplaces" element={<Marketplaces />} />
          <Route path="/dashboard/admin/data-export" element={<DataExport />} />
          <Route path="/dashboard/admin/security" element={<Dashboard />}>
            <Route index element={<SecurityMonitoring />} />
          </Route>
          <Route path="/presentation" element={<Presentation />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AnimatedRoutes>
        </AdminPgpGate>
        </MobileAppRouteGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
