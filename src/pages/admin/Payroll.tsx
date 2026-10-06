import eppLogo from "@/assets/epp-logo-dark.png";
import { useState, useEffect } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-stub";
import { Plus, Download, Trash2, Zap, CheckCircle, Clock, Euro } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { adjustToWeekdayString } from "@/lib/dateUtils";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  street?: string;
  postal_code?: string;
  city?: string;
  tax_id?: string;
  social_security_number?: string;
  employment_type?: string;
  tax_class?: number;
  federal_state?: string;
  church_tax_liable?: boolean;
  iban?: string;
  account_holder?: string;
}

interface CompanyContact {
  company_name: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  main_phone: string | null;
  main_email: string | null;
  managing_director: string | null;
  trade_register_number: string | null;
  register_court: string | null;
}

interface PayrollEntry {
  id: string;
  user_id: string;
  month: number;
  year: number;
  gross_salary: number;
  working_hours: number;
  hourly_rate: number | null;
  tax_deduction: number;
  social_security: number;
  health_insurance: number;
  other_deductions: number;
  net_salary: number;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  profiles?: Profile;
}

interface FreelancerInvoice {
  id: string;
  user_id: string;
  task_id: string;
  submission_id: string;
  task_title: string;
  hours_worked: number;
  hourly_rate: number;
  gross_amount: number;
  invoice_number: string;
  invoice_date: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  profiles?: Profile;
}

const AdminPayroll = () => {
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [freelancerInvoices, setFreelancerInvoices] = useState<FreelancerInvoice[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [companyContact, setCompanyContact] = useState<CompanyContact | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("employees");

  const [formData, setFormData] = useState({
    user_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    gross_salary: 0,
    working_hours: 0,
    hourly_rate: 0,
    tax_deduction: 0,
    social_security: 0,
    health_insurance: 0,
    other_deductions: 0,
    payment_date: "",
    notes: "",
    employment_type: "vollzeit",
    start_date: "",
  });

  // Safely format potentially invalid/null dates
  const safeFormatDate = (value: string | Date | null | undefined, pattern: string, loc?: any) => {
    if (!value) return "-";
    const d = value instanceof Date ? value : new Date(value as string);
    if (isNaN(d.getTime())) return "-";
    try {
      return loc ? format(d, pattern, { locale: loc }) : format(d, pattern);
    } catch {
      return "-";
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch payroll entries
      const { data: payrollData, error: payrollError } = await supabase
        .from("payroll")
        .select(
          `
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
            email,
            street,
            postal_code,
            city,
            tax_id,
            social_security_number,
            employment_type,
            tax_class,
            federal_state,
            church_tax_liable,
            iban,
            account_holder
          )
        `,
        )
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (payrollError) throw payrollError;

      // Fetch freelancer invoices
      const { data: freelancerData, error: freelancerError } = await supabase
        .from("freelancer_invoices")
        .select(
          `
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
            email,
            iban,
            account_holder
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (freelancerError) console.error("Error fetching freelancer invoices:", freelancerError);

      // Fetch all employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("last_name");

      if (employeesError) throw employeesError;

      // Fetch company contact
      const { data: companyData, error: companyError } = await supabase.from("company_contact").select("*").single();

      if (companyError) console.error("Error fetching company contact:", companyError);

      setPayrollEntries(payrollData || []);
      setFreelancerInvoices(freelancerData || []);
      setEmployees(employeesData || []);
      setCompanyContact(companyData);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const calculateNetSalary = () => {
    const { gross_salary, tax_deduction, social_security, health_insurance, other_deductions, employment_type } =
      formData;
    const isMinijob = (employment_type || "").toLowerCase() === "minijob";
    const solidarity = isMinijob ? 0 : (tax_deduction || 0) * 0.055;
    const churchRate =
      selectedProfile && (selectedProfile.federal_state === "BY" || selectedProfile.federal_state === "BW")
        ? 0.08
        : 0.09;
    const church =
      !isMinijob && selectedProfile && selectedProfile.church_tax_liable !== false
        ? (tax_deduction || 0) * churchRate
        : 0;
    return (
      (gross_salary || 0) -
      (tax_deduction || 0) -
      (social_security || 0) -
      (health_insurance || 0) -
      (other_deductions || 0) -
      solidarity -
      church
    );
  };

  const calculateAutomaticDeductions = async (grossSalary: number, userId: string, employmentTypeOverride?: string) => {
    if (!grossSalary || grossSalary <= 0) {
      return { taxDeduction: 0, healthInsurance: 0, socialSecurity: 0 };
    }

    // Hole Mitarbeiterdaten für korrekte Berechnung
    const { data: profile } = await supabase
      .from("profiles")
      .select("employment_type, tax_class, federal_state")
      .eq("id", userId)
      .maybeSingle();

    const employmentType = (employmentTypeOverride || profile?.employment_type || "vollzeit").toLowerCase();
    const taxClass = profile?.tax_class || 1;

    // Minijob: No deductions for employee - employer pays flat-rate contributions
    if (employmentType === "minijob") {
      return { taxDeduction: 0, healthInsurance: 0, socialSecurity: 0 };
    }

    // Midijob (538,01€ - 2000€): Reduzierte Sozialversicherung (Gleitzone)
    if (grossSalary > 538 && grossSalary <= 2000) {
      const factor = (grossSalary - 538) / 1462; // Gleitzonenfaktor

      // Reduzierte SV-Beiträge in der Gleitzone
      const rvRate = 0.093 * factor; // Rentenversicherung
      const avRate = 0.012 * factor; // Arbeitslosenversicherung
      const pvRate = 0.01525 * factor; // Pflegeversicherung
      const kvRate = 0.073 * factor; // Krankenversicherung

      const socialSecurity = grossSalary * (rvRate + avRate + pvRate);
      const healthInsurance = grossSalary * kvRate;

      // Lohnsteuer nach Steuerklasse (auch reduziert)
      let taxRate = 0;
      if (taxClass === 1) taxRate = 0.08 * factor;
      else if (taxClass === 2) taxRate = 0.06 * factor;
      else if (taxClass === 3) taxRate = 0.04 * factor;
      else if (taxClass === 4) taxRate = 0.08 * factor;
      else if (taxClass === 5) taxRate = 0.15 * factor;
      else if (taxClass === 6) taxRate = 0.18 * factor;

      const taxDeduction = grossSalary * taxRate;

      return { taxDeduction, healthInsurance, socialSecurity };
    }

    // Vollzeit/Teilzeit: Normale Abzüge ab 2000€
    // Lohnsteuer abhängig von Steuerklasse (vereinfachte Berechnung)
    let taxRate = 0.2; // Standard
    if (taxClass === 1)
      taxRate = 0.18; // Ledig, keine Kinder
    else if (taxClass === 2)
      taxRate = 0.16; // Alleinerziehend (mit Entlastungsbetrag)
    else if (taxClass === 3)
      taxRate = 0.12; // Verheiratet, höheres Einkommen
    else if (taxClass === 4)
      taxRate = 0.18; // Verheiratet, gleiche Einkommen
    else if (taxClass === 5)
      taxRate = 0.28; // Verheiratet, niedrigeres Einkommen
    else if (taxClass === 6) taxRate = 0.32; // Nebenjob (höchster Steuersatz)

    const taxDeduction = grossSalary * taxRate;

    // Krankenversicherung (7,3% AN-Anteil + durchschnittlich 0,9% Zusatzbeitrag)
    const healthInsurance = grossSalary * 0.073;

    // Sozialversicherung gesamt (ohne KV):
    // Rentenversicherung: 9,3% AN-Anteil
    // Arbeitslosenversicherung: 1,2% AN-Anteil
    // Pflegeversicherung: 1,525% AN-Anteil (1,7% für Kinderlose ab 23)
    const socialSecurity = grossSalary * (0.093 + 0.012 + 0.01525);

    return { taxDeduction, healthInsurance, socialSecurity };
  };

  const getDefaultGross = (employmentType: string) => {
    const type = (employmentType || "").toLowerCase();
    if (type === "vollzeit") return 3890;
    if (type === "teilzeit") return 2560;
    if (type === "minijob") return 603; // 2025 Minijob-Grenze
    if (type === "werkstudent") return 1000;
    return 0;
  };

  const prorateByStartDate = (
    employmentType: string,
    startDate: string | undefined,
    month: number,
    year: number,
    fullGross: number,
  ) => {
    const type = (employmentType || "").toLowerCase();
    const fullHours = type === "vollzeit" ? 152 : type === "teilzeit" ? 80 : type === "minijob" ? 40 : 80;
    if (!startDate) {
      return { adjustedSalary: fullGross, adjustedHours: fullHours, proRataNote: "" };
    }
    const empStart = new Date(startDate);
    const startY = empStart.getFullYear();
    const startM = empStart.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    // Wenn im Abrechnungsmonat gestartet, anteilig ab Starttag
    if (startY === year && startM === month) {
      const startDay = empStart.getDate();
      const workedDays = Math.max(0, daysInMonth - startDay + 1);
      const adjustedSalary = (fullGross / daysInMonth) * workedDays;
      const adjustedHours = (fullHours / daysInMonth) * workedDays;
      const proRataNote = `Anteilige Berechnung: Arbeitsbeginn am ${String(startDay).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}, daher ${workedDays} von ${daysInMonth} Tagen`;
      return { adjustedSalary, adjustedHours, proRataNote };
    }
    return { adjustedSalary: fullGross, adjustedHours: fullHours, proRataNote: "" };
  };

  const handleGrossSalaryChange = async (value: number) => {
    if (!formData.user_id) {
      // Update nur das Bruttogehalt, Abzüge kommen später wenn User ausgewählt wird
      setFormData({
        ...formData,
        gross_salary: value,
      });
      return;
    }

    const deductions = await calculateAutomaticDeductions(value, formData.user_id, formData.employment_type);
    setFormData({
      ...formData,
      gross_salary: value,
      tax_deduction: deductions.taxDeduction,
      health_insurance: deductions.healthInsurance,
      social_security: deductions.socialSecurity,
    });
  };

  const handleMonthChange = async (newMonth: number) => {
    const fullGross = getDefaultGross(formData.employment_type);
    const { adjustedSalary, adjustedHours, proRataNote } = prorateByStartDate(
      formData.employment_type,
      formData.start_date,
      newMonth,
      formData.year,
      fullGross,
    );

    let next = {
      ...formData,
      month: newMonth,
      gross_salary: adjustedSalary,
      working_hours: adjustedHours,
      notes: proRataNote || formData.notes,
    };

    if (formData.user_id && adjustedSalary > 0) {
      const d = await calculateAutomaticDeductions(adjustedSalary, formData.user_id, formData.employment_type);
      next = {
        ...next,
        tax_deduction: d.taxDeduction,
        health_insurance: d.healthInsurance,
        social_security: d.socialSecurity,
      };
    }

    setFormData(next);
  };

  const handleYearChange = async (newYear: number) => {
    const fullGross = getDefaultGross(formData.employment_type);
    const { adjustedSalary, adjustedHours, proRataNote } = prorateByStartDate(
      formData.employment_type,
      formData.start_date,
      formData.month,
      newYear,
      fullGross,
    );

    let next = {
      ...formData,
      year: newYear,
      gross_salary: adjustedSalary,
      working_hours: adjustedHours,
      notes: proRataNote || formData.notes,
    };

    if (formData.user_id && adjustedSalary > 0) {
      const d = await calculateAutomaticDeductions(adjustedSalary, formData.user_id, formData.employment_type);
      next = {
        ...next,
        tax_deduction: d.taxDeduction,
        health_insurance: d.healthInsurance,
        social_security: d.socialSecurity,
      };
    }

    setFormData(next);
  };

  const handleEmployeeChange = async (userId: string) => {
    // Fetch employee data to get their employment type
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, email, street, postal_code, city, tax_id, social_security_number, employment_type, tax_class, federal_state, church_tax_liable, iban, account_holder",
      )
      .eq("id", userId)
      .maybeSingle();

    const employmentType = profile?.employment_type?.toLowerCase() || "vollzeit";
    setSelectedProfile(profile as Profile | null);

    // Fetch employee's start date from their contract
    const { data: contractDoc } = await supabase
      .from("employee_documents")
      .select("start_date, content")
      .eq("user_id", userId)
      .eq("document_type", "contract")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startDate = contractDoc?.start_date || "";

    // Set default salary based on employment type
    let defaultGrossSalary = 0;
    if (employmentType === "vollzeit") {
      defaultGrossSalary = 3890;
    } else if (employmentType === "teilzeit") {
      defaultGrossSalary = 2560;
    } else if (employmentType === "minijob") {
      defaultGrossSalary = 603; // Minijob limit for 2025
    } else if (employmentType === "werkstudent") {
      defaultGrossSalary = 1000;
    }

    // Calculate pro-rata salary if employee started mid-month
    let adjustedSalary = defaultGrossSalary;
    let adjustedHours = 0;
    let proRataNote = "";

    if (startDate) {
      const empStartDate = new Date(startDate);
      const startYear = empStartDate.getFullYear();
      const startMonth = empStartDate.getMonth() + 1; // 1-12

      // Check if employee started in the selected payroll month
      if (startYear === formData.year && startMonth === formData.month) {
        const daysInMonth = new Date(formData.year, formData.month, 0).getDate();
        const startDay = empStartDate.getDate();
        const workedDays = daysInMonth - startDay + 1;

        adjustedSalary = (defaultGrossSalary / daysInMonth) * workedDays;

        // Calculate working hours based on employment type
        let fullMonthHours = 0;
        if (employmentType === "vollzeit") fullMonthHours = 152;
        else if (employmentType === "teilzeit") fullMonthHours = 80;
        else if (employmentType === "minijob") fullMonthHours = 40;
        else if (employmentType === "werkstudent") fullMonthHours = 80;

        adjustedHours = (fullMonthHours / daysInMonth) * workedDays;

        proRataNote = `Anteilige Berechnung: Arbeitsbeginn am ${startDay}.${String(formData.month).padStart(2, "0")}.${formData.year}, daher ${workedDays} von ${daysInMonth} Tagen`;
      }
    }

    setFormData({
      ...formData,
      user_id: userId,
      employment_type: employmentType,
      gross_salary: adjustedSalary,
      working_hours: adjustedHours,
      start_date: startDate,
      notes: proRataNote,
    });

    if (userId && adjustedSalary > 0) {
      const deductions = await calculateAutomaticDeductions(adjustedSalary, userId, employmentType);
      setFormData({
        ...formData,
        user_id: userId,
        employment_type: employmentType,
        gross_salary: adjustedSalary,
        working_hours: adjustedHours,
        tax_deduction: deductions.taxDeduction,
        health_insurance: deductions.healthInsurance,
        social_security: deductions.socialSecurity,
        start_date: startDate,
        notes: proRataNote,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate: Check if payroll month/year is before employee's start date
    try {
      // Fetch employee's start date from their contract
      const { data: contractDoc } = await supabase
        .from("employee_documents")
        .select("start_date")
        .eq("user_id", formData.user_id)
        .eq("document_type", "contract")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractDoc?.start_date) {
        const startDate = new Date(contractDoc.start_date);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth() + 1; // 1-12

        // Compare payroll month/year with start date
        const payrollDate = new Date(formData.year, formData.month - 1, 1);
        const employeeStartDate = new Date(startYear, startMonth - 1, 1);

        if (payrollDate < employeeStartDate) {
          toast.error(
            `Lohnabrechnung kann nicht erstellt werden: Der Mitarbeiter hat erst am ${startDate.getDate()}.${String(startMonth).padStart(2, "0")}.${startYear} angefangen. ` +
              `Sie versuchen eine Abrechnung für ${formData.month}/${formData.year} zu erstellen.`,
            { duration: 6000 },
          );
          return;
        }
      }

      const net_salary = calculateNetSalary();

      // Only include fields that exist in the payroll table
      const { error } = await supabase.from("payroll").insert({
        user_id: formData.user_id,
        month: formData.month,
        year: formData.year,
        gross_salary: formData.gross_salary,
        working_hours: formData.working_hours,
        hourly_rate: formData.hourly_rate || null,
        tax_deduction: formData.tax_deduction,
        social_security: formData.social_security,
        health_insurance: formData.health_insurance,
        other_deductions: formData.other_deductions,
        net_salary,
        payment_date: formData.payment_date || null,
        notes: formData.notes,
      });

      if (error) throw error;

      toast.success("Lohnabrechnung erstellt");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error creating payroll:", error);
      toast.error(error.message || "Fehler beim Erstellen der Lohnabrechnung");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Lohnabrechnung wirklich löschen?")) return;

    try {
      const { error } = await supabase.from("payroll").delete().eq("id", id);
      if (error) throw error;

      toast.success("Lohnabrechnung gelöscht");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting payroll:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const downloadPayrollPDF = async (entry: PayrollEntry) => {
    console.log("Starting PDF generation for entry:", entry.id);

    try {
      toast.info("PDF wird generiert...");

      // Fetch logo and convert to data URL
      const logoResponse = await fetch(eppLogo);
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });

      const employee = entry.profiles;
      if (!employee) {
        toast.error("Mitarbeiterdaten nicht gefunden");
        return;
      }

      // Fetch employee's start date from their contract
      const { data: contractDoc } = await supabase
        .from("employee_documents")
        .select("start_date")
        .eq("user_id", entry.user_id)
        .eq("document_type", "contract")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startDate = contractDoc?.start_date;

      // Calculate billing period
      let periodStart = `01.${String(entry.month).padStart(2, "0")}.${entry.year}`;
      let periodEnd = `${new Date(entry.year, entry.month, 0).getDate()}.${String(entry.month).padStart(2, "0")}.${entry.year}`;

      // Check if employee started in the billing month
      if (startDate) {
        const empStartDate = new Date(startDate);
        const startYear = empStartDate.getFullYear();
        const startMonth = empStartDate.getMonth() + 1; // 1-12

        if (startYear === entry.year && startMonth === entry.month) {
          // Employee started mid-month, adjust period start
          periodStart = `${empStartDate.getDate()}.${String(entry.month).padStart(2, "0")}.${entry.year}`;
        }
      }

      const monthName = monthNames[entry.month - 1];

      // Check if Minijob - different tax treatment
      const isMinijob = (employee.employment_type || "").toLowerCase() === "minijob";
      const solidaritySurcharge = !isMinijob ? entry.tax_deduction * 0.055 : 0;
      const rvAmount = entry.social_security * 0.48;
      const avAmount = entry.social_security * 0.2;
      const pvAmount = entry.social_security * 0.32;

      // Calculate church tax based on federal state and liability (not for Minijobs)
      const churchTaxRate = employee.federal_state === "BY" || employee.federal_state === "BW" ? 0.08 : 0.09;
      const churchTax = !isMinijob && employee.church_tax_liable !== false ? entry.tax_deduction * churchTaxRate : 0;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Lohnabrechnung ${monthName} ${entry.year}</title>
            <style>
              @page {
                size: A4;
                margin: 20mm;
              }
              body {
                font-family: Arial, sans-serif;
                font-size: 10pt;
                line-height: 1.4;
                color: #000;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                padding-bottom: 15px;
                border-bottom: 2px solid #000;
              }
              .logo {
                max-width: 150px;
                height: auto;
              }
              .company-info {
                text-align: right;
                font-size: 9pt;
              }
              .title {
                text-align: center;
                font-size: 16pt;
                font-weight: bold;
                margin: 20px 0;
              }
              .section {
                margin-bottom: 20px;
              }
              .section-title {
                font-weight: bold;
                font-size: 11pt;
                margin-bottom: 8px;
                padding: 5px;
                background: #f0f0f0;
              }
              .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 15px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                padding: 3px 0;
              }
              .label {
                font-weight: 500;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
              }
              th, td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
              }
              th {
                background: #f5f5f5;
                font-weight: bold;
              }
              .amount {
                text-align: right;
                font-family: "Courier New", monospace;
              }
              .total-row {
                font-weight: bold;
                background: #f0f0f0;
              }
              .net-amount {
                font-size: 14pt;
                font-weight: bold;
                text-align: right;
                padding: 15px;
                background: #e8f5e9;
                margin: 20px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 15px;
                border-top: 1px solid #ccc;
                font-size: 8pt;
                text-align: center;
                color: #666;
              }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoDataUrl}" alt="Company Logo" class="logo" />
              <div class="company-info">
                <strong>${companyContact?.company_name || "Firma"}</strong><br>
                ${companyContact?.street_address || ""}<br>
                ${companyContact?.postal_code || ""} ${companyContact?.city || ""}<br>
                Tel: ${companyContact?.main_phone || ""}<br>
                Email: ${companyContact?.main_email || ""}
              </div>
            </div>

            <div class="title">
              LOHNABRECHNUNG ${monthName.toUpperCase()} ${entry.year}
            </div>

            <div class="section">
              <div class="info-row">
                <span class="label">Abrechnungszeitraum:</span>
                <span>${periodStart} - ${periodEnd}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Arbeitnehmer</div>
              <div class="info-grid">
                <div>
                  <div class="info-row">
                    <span class="label">Name:</span>
                    <span>${employee.first_name} ${employee.last_name}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Adresse:</span>
                    <span>${employee.street || "-"}</span>
                  </div>
                    <div class="info-row">
                      <span class="label">PLZ/Ort:</span>
                      <span>${employee.postal_code || ""} ${employee.city || ""}</span>
                    </div>
                </div>
                <div>
                  <div class="info-row">
                    <span class="label">Steuer-ID:</span>
                    <span>${employee.tax_id || "-"}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">SV-Nummer:</span>
                    <span>${employee.social_security_number || "-"}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Steuerklasse:</span>
                    <span>${employee.tax_class || "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Arbeitgeber</div>
              <div class="info-row">
                <span class="label">Firma:</span>
                <span>${companyContact?.company_name || "-"}</span>
              </div>
              <div class="info-row">
                <span class="label">Handelsregister:</span>
                <span>${companyContact?.register_court || ""} ${companyContact?.trade_register_number || ""}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Bezüge</div>
              <table>
                <tr>
                  <th>Bezeichnung</th>
                  <th class="amount">Stunden</th>
                  <th class="amount">Satz</th>
                  <th class="amount">Betrag (€)</th>
                </tr>
                <tr>
                  <td>${employee.employment_type || "Gehalt"}</td>
                  <td class="amount">${entry.working_hours.toFixed(1)}</td>
                  <td class="amount">${entry.hourly_rate ? entry.hourly_rate.toFixed(2) : "-"}</td>
                  <td class="amount">${entry.gross_salary.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3">Brutto-Bezug</td>
                  <td class="amount">${entry.gross_salary.toFixed(2)} €</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <div class="section-title">Abzüge</div>
              <table>
                <tr>
                  <th>Bezeichnung</th>
                  <th class="amount">AN-Anteil (%)</th>
                  <th class="amount">Betrag (€)</th>
                </tr>
                <tr>
                  <td>${isMinijob ? "Pauschalsteuer (Arbeitgeberanteil)" : "Lohnsteuer"}</td>
                  <td class="amount">${isMinijob ? "2%" : "-"}</td>
                  <td class="amount">${entry.tax_deduction.toFixed(2)}</td>
                </tr>
                ${
                  !isMinijob
                    ? `
                <tr>
                  <td>Solidaritätszuschlag</td>
                  <td class="amount">5,5%</td>
                  <td class="amount">${solidaritySurcharge.toFixed(2)}</td>
                </tr>
                `
                    : ""
                }
                ${
                  churchTax > 0
                    ? `
                <tr>
                  <td>Kirchensteuer</td>
                  <td class="amount">${(churchTaxRate * 100).toFixed(1)}%</td>
                  <td class="amount">${churchTax.toFixed(2)}</td>
                </tr>
                `
                    : ""
                }
                ${
                  !isMinijob
                    ? `
                <tr>
                  <td>Krankenversicherung</td>
                  <td class="amount">7,3%</td>
                  <td class="amount">${entry.health_insurance.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Rentenversicherung</td>
                  <td class="amount">9,3%</td>
                  <td class="amount">${rvAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Arbeitslosenversicherung</td>
                  <td class="amount">1,2%</td>
                  <td class="amount">${avAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Pflegeversicherung</td>
                  <td class="amount">1,525%</td>
                  <td class="amount">${pvAmount.toFixed(2)}</td>
                </tr>
                `
                    : ""
                }
                ${
                  entry.other_deductions > 0
                    ? `
                <tr>
                  <td>Sonstige Abzüge</td>
                  <td class="amount">-</td>
                  <td class="amount">${entry.other_deductions.toFixed(2)}</td>
                </tr>
                `
                    : ""
                }
                <tr class="total-row">
                  <td colspan="2">Gesamt-Abzüge</td>
                  <td class="amount">${(entry.tax_deduction + solidaritySurcharge + churchTax + (entry.health_insurance || 0) + (entry.social_security || 0) + (entry.other_deductions || 0)).toFixed(2)} €</td>
                </tr>
              </table>
            </div>

            <div class="net-amount">
              Auszahlungsbetrag: ${entry.net_salary.toFixed(2)} €
            </div>

            <div class="section">
              <div class="info-row">
                <span class="label">Auszahlungsdatum:</span>
                <span>${safeFormatDate(entry.payment_date, "dd.MM.yyyy", de)}</span>
              </div>
              ${
                employee.iban
                  ? `
              <div class="info-row">
                <span class="label">Auszahlungskonto (IBAN):</span>
                <span style="font-family: 'Courier New', monospace;">${employee.iban}</span>
              </div>
              ${
                employee.account_holder
                  ? `
              <div class="info-row">
                <span class="label">Kontoinhaber:</span>
                <span>${employee.account_holder}</span>
              </div>
              `
                  : ""
              }
              <div class="info-row">
                <span class="label"></span>
                <span style="font-style: italic; font-size: 9pt; color: #666;">Der Betrag wurde auf das angegebene Konto überwiesen.</span>
              </div>
              `
                  : ""
              }
              ${
                entry.notes
                  ? `
              <div class="info-row">
                <span class="label">Hinweise:</span>
                <span>${entry.notes}</span>
              </div>
              `
                  : ""
              }
            </div>

            <div class="footer">
              <p>Diese Lohnabrechnung wurde elektronisch erstellt und ist ohne Unterschrift gültig.</p>
              <p>${companyContact?.company_name || ""} | ${companyContact?.managing_director ? "Geschäftsführer: " + companyContact.managing_director : ""}</p>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      console.log("Print window opened:", printWindow !== null);

      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          toast.success("PDF-Vorschau geöffnet - Bitte Pop-ups erlauben falls blockiert");
        }, 500);
      } else {
        toast.error("Pop-up wurde blockiert! Bitte erlauben Sie Pop-ups für diese Website.");
        console.error("Window.open was blocked by the browser");
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error("Fehler beim Erstellen der PDF: " + error.message);
    }
  };

  const handleGenerateMonthlyPayroll = async () => {
    if (!confirm("Möchten Sie die monatlichen Lohnabrechnungen für alle Mitarbeiter generieren?")) return;

    setGeneratingPayroll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-payroll");

      if (error) throw error;

      toast.success(`Lohnabrechnungen erfolgreich erstellt: ${data.created} Einträge`);
      if (data.errors > 0) {
        toast.warning(`${data.errors} Fehler aufgetreten. Details in der Konsole.`);
        console.error("Payroll generation errors:", data.details);
      }

      fetchData();
    } catch (error: any) {
      console.error("Error generating payroll:", error);
      toast.error(error.message || "Fehler beim Generieren der Lohnabrechnungen");
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      gross_salary: 0,
      working_hours: 0,
      hourly_rate: 0,
      tax_deduction: 0,
      social_security: 0,
      health_insurance: 0,
      other_deductions: 0,
      payment_date: "",
      notes: "",
      employment_type: "vollzeit",
      start_date: "",
    });
  };

  const monthNames = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Lohnabrechnungen</h1>
        <div className="flex gap-2">
          <Button onClick={handleGenerateMonthlyPayroll} disabled={generatingPayroll} variant="outline">
            <Zap className="w-4 h-4 mr-2" />
            {generatingPayroll ? "Generiere..." : "Monatlich generieren"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Neue Abrechnung
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neue Lohnabrechnung erstellen</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Mitarbeiter</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formData.user_id}
                      onChange={(e) => handleEmployeeChange(e.target.value)}
                      required
                    >
                      <option value="">Auswählen...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Abzüge werden basierend auf Steuerklasse und Beschäftigungsart berechnet
                    </p>
                  </div>
                  <div>
                    <Label>Beschäftigungsart</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formData.employment_type}
                      onChange={async (e) => {
                        const newEmploymentType = e.target.value;
                        let defaultGrossSalary = formData.gross_salary;

                        // Set default salary based on employment type
                        if (newEmploymentType === "vollzeit") {
                          defaultGrossSalary = 3890;
                        } else if (newEmploymentType === "teilzeit") {
                          defaultGrossSalary = 2560;
                        } else if (newEmploymentType === "minijob") {
                          defaultGrossSalary = 603; // Minijob limit for 2025
                        } else if (newEmploymentType === "werkstudent") {
                          defaultGrossSalary = 1000;
                        }

                        setFormData({
                          ...formData,
                          employment_type: newEmploymentType,
                          gross_salary: defaultGrossSalary,
                        });

                        // Recalculate deductions if user is selected
                        if (formData.user_id && defaultGrossSalary > 0) {
                          const deductions = await calculateAutomaticDeductions(
                            defaultGrossSalary,
                            formData.user_id,
                            newEmploymentType,
                          );
                          setFormData((prev) => ({
                            ...prev,
                            employment_type: newEmploymentType,
                            gross_salary: defaultGrossSalary,
                            tax_deduction: deductions.taxDeduction,
                            health_insurance: deductions.healthInsurance,
                            social_security: deductions.socialSecurity,
                          }));
                        }
                      }}
                      required
                    >
                      <option value="vollzeit">Vollzeit</option>
                      <option value="teilzeit">Teilzeit</option>
                      <option value="minijob">Minijob</option>
                      <option value="werkstudent">Werkstudent</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">Gehalt und Abzüge werden automatisch angepasst</p>
                  </div>
                  <div>
                    <Label>Monat</Label>
                    <select
                      className="w-full border rounded p-2"
                      value={formData.month}
                      onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                      required
                    >
                      {monthNames.map((name, idx) => (
                        <option key={idx} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Jahr</Label>
                    <Input
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleYearChange(parseInt(e.target.value))}
                      required
                    />
                  </div>
                  {formData.start_date && (
                    <div>
                      <Label>Startdatum</Label>
                      <Input
                        type="text"
                        value={(function () {
                          const v = safeFormatDate(formData.start_date, "dd.MM.yyyy", de);
                          return v === "-" ? "" : v;
                        })()}
                        readOnly
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Aus Arbeitsvertrag ausgelesen</p>
                    </div>
                  )}
                  <div>
                    <Label>Bruttogehalt / Tariflohn (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.gross_salary || ""}
                      onChange={(e) => handleGrossSalaryChange(parseFloat(e.target.value) || 0)}
                      required
                      placeholder="z.B. 3890.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Alle Abzüge werden automatisch berechnet</p>
                  </div>
                  <div>
                    <Label>Arbeitsstunden</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={formData.working_hours}
                      onChange={(e) => setFormData({ ...formData, working_hours: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Stundensatz (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Lohnsteuer (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.tax_deduction.toFixed(2)}
                      onChange={(e) => setFormData({ ...formData, tax_deduction: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatisch berechnet nach Steuerklasse (manuell anpassbar)
                    </p>
                  </div>
                  <div>
                    <Label>Krankenversicherung - AN-Anteil (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.health_insurance.toFixed(2)}
                      onChange={(e) => setFormData({ ...formData, health_insurance: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">7,30% vom Brutto</p>
                  </div>
                  <div>
                    <Label>Rentenversicherung - AN-Anteil (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(formData.social_security * 0.48).toFixed(2)}
                      onChange={(e) => {
                        const rv = parseFloat(e.target.value) || 0;
                        const total = rv / 0.48;
                        setFormData({ ...formData, social_security: total });
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">9,30% vom Brutto</p>
                  </div>
                  <div>
                    <Label>Arbeitslosenversicherung - AN-Anteil (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(formData.social_security * 0.2).toFixed(2)}
                      onChange={(e) => {
                        const av = parseFloat(e.target.value) || 0;
                        const total = av / 0.2;
                        setFormData({ ...formData, social_security: total });
                      }}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">1,20% vom Brutto</p>
                  </div>
                  <div>
                    <Label>Pflegeversicherung - AN-Anteil (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(formData.social_security * 0.32).toFixed(2)}
                      onChange={(e) => {
                        const pv = parseFloat(e.target.value) || 0;
                        const total = pv / 0.32;
                        setFormData({ ...formData, social_security: total });
                      }}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      1,525% vom Brutto (ggf. Zuschlag für Kinderlose)
                    </p>
                  </div>
                  <div>
                    <Label>Sonstige Abzüge (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.other_deductions}
                      onChange={(e) => setFormData({ ...formData, other_deductions: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Auszahlungsdatum</Label>
                    <Input
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        if (selectedDate) {
                          const adjustedDate = adjustToWeekdayString(selectedDate);
                          setFormData({ ...formData, payment_date: adjustedDate });

                          // Benachrichtigung wenn Datum angepasst wurde
                          if (adjustedDate !== selectedDate) {
                            const original = new Date(selectedDate);
                            const dayName = original.getDay() === 0 ? "Sonntag" : "Samstag";
                            toast.info(`Datum angepasst: ${dayName} ist kein Werktag`);
                          }
                        } else {
                          setFormData({ ...formData, payment_date: selectedDate });
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wird automatisch auf einen Werktag angepasst (Mo-Fr)
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Notizen</Label>
                  <textarea
                    className="w-full border rounded p-2"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="bg-muted p-4 rounded space-y-3">
                  <h4 className="font-semibold text-sm">Berechnung</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Bruttogehalt:</span>
                      <span className="font-medium">{formData.gross_salary.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>- Lohnsteuer:</span>
                      <span>-{formData.tax_deduction.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>- Solidaritätszuschlag (5,5%):</span>
                      <span>-{(formData.tax_deduction * 0.055).toFixed(2)} €</span>
                    </div>
                    {selectedProfile &&
                      selectedProfile.church_tax_liable !== false &&
                      formData.employment_type?.toLowerCase() !== "minijob" && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-4">
                          <span>- Kirchensteuer:</span>
                          <span>
                            -
                            {(
                              formData.tax_deduction *
                              (selectedProfile.federal_state === "BY" || selectedProfile.federal_state === "BW"
                                ? 0.08
                                : 0.09)
                            ).toFixed(2)}{" "}
                            €
                          </span>
                        </div>
                      )}
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>- Krankenversicherung:</span>
                      <span>-{formData.health_insurance.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>- Rentenversicherung:</span>
                      <span>-{(formData.social_security * 0.48).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>- Arbeitslosenversicherung:</span>
                      <span>-{(formData.social_security * 0.2).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>- Pflegeversicherung:</span>
                      <span>-{(formData.social_security * 0.32).toFixed(2)} €</span>
                    </div>
                    {formData.other_deductions > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground pl-4">
                        <span>- Sonstige Abzüge:</span>
                        <span>-{formData.other_deductions.toFixed(2)} €</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Auszahlungsbetrag:</span>
                      <span className="text-xl font-bold text-primary">{calculateNetSalary().toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit">Erstellen</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Angestellte ({payrollEntries.length})
          </TabsTrigger>
          <TabsTrigger value="freelancer" className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Freelancer ({freelancerInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Lohnabrechnungen Angestellte</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Monat</TableHead>
                    <TableHead>Brutto</TableHead>
                    <TableHead>Netto</TableHead>
                    <TableHead>Stunden</TableHead>
                    <TableHead>Auszahlung</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.profiles?.first_name} {entry.profiles?.last_name}
                      </TableCell>
                      <TableCell>
                        {monthNames[entry.month - 1]} {entry.year}
                      </TableCell>
                      <TableCell>{entry.gross_salary.toFixed(2)} €</TableCell>
                      <TableCell className="font-semibold">{entry.net_salary.toFixed(2)} €</TableCell>
                      <TableCell>{entry.working_hours || 0}h</TableCell>
                      <TableCell>{safeFormatDate(entry.payment_date, "dd.MM.yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadPayrollPDF(entry)}
                            title="PDF herunterladen"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payrollEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Noch keine Lohnabrechnungen vorhanden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freelancer">
          <Card>
            <CardHeader>
              <CardTitle>Freelancer Honorarabrechnungen</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Statistiken */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Gesamt</p>
                  <p className="text-2xl font-bold">
                    {freelancerInvoices.reduce((sum, inv) => sum + inv.gross_amount, 0).toFixed(2)} €
                  </p>
                </div>
                <div className="bg-amber-500/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Ausstehend</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {freelancerInvoices
                      .filter((i) => i.status === "pending")
                      .reduce((sum, inv) => sum + inv.gross_amount, 0)
                      .toFixed(2)}{" "}
                    €
                  </p>
                </div>
                <div className="bg-green-500/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Bezahlt</p>
                  <p className="text-2xl font-bold text-green-600">
                    {freelancerInvoices
                      .filter((i) => i.status === "paid")
                      .reduce((sum, inv) => sum + inv.gross_amount, 0)
                      .toFixed(2)}{" "}
                    €
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Freelancer</TableHead>
                    <TableHead>Rechnungsnr.</TableHead>
                    <TableHead>Auftrag</TableHead>
                    <TableHead>Stunden</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {freelancerInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        {invoice.profiles?.first_name} {invoice.profiles?.last_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{invoice.task_title}</TableCell>
                      <TableCell>
                        {invoice.hours_worked}h × {invoice.hourly_rate}€
                      </TableCell>
                      <TableCell className="font-semibold">{invoice.gross_amount.toFixed(2)} €</TableCell>
                      <TableCell>
                        {invoice.status === "paid" ? (
                          <Badge className="bg-green-500 hover:bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" /> Bezahlt
                          </Badge>
                        ) : invoice.status === "pending" ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            <Clock className="h-3 w-3 mr-1" /> Ausstehend
                          </Badge>
                        ) : (
                          <Badge variant="destructive">{invoice.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {invoice.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500 text-green-600 hover:bg-green-50"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("freelancer_invoices")
                                  .update({ status: "paid", paid_at: new Date().toISOString() })
                                  .eq("id", invoice.id);
                                if (error) {
                                  toast.error("Fehler beim Aktualisieren");
                                } else {
                                  toast.success("Als bezahlt markiert");
                                  fetchData();
                                }
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" /> Bezahlt
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteFreelancerInvoice(invoice.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {freelancerInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Noch keine Freelancer-Abrechnungen vorhanden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  // Freelancer invoice delete function
  async function handleDeleteFreelancerInvoice(id: string) {
    if (!confirm("Wirklich löschen?")) return;
    const { error } = await supabase.from("freelancer_invoices").delete().eq("id", id);
    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Rechnung gelöscht");
      fetchData();
    }
  }
};

export default AdminPayroll;
