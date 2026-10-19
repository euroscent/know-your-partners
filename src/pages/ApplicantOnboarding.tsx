import { ApplicantProgress } from "@/components/ApplicantProgress";
import { useI18n } from "@/lib/i18n";
export default function ApplicantOnboarding() {
  const { lang } = useI18n();
  return <div className="p-4 md:p-8 max-w-4xl mx-auto"><h1 className="text-3xl font-semibold mb-6">{lang === 'en' ? 'Your employee onboarding' : 'Ihre Mitarbeiteraufnahme'}</h1><ApplicantProgress /></div>;
}