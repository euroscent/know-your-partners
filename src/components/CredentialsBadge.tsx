import { useState } from "react";
import { Mail, User, Lock, KeyRound, Link2, Info, Copy, Check, Shield } from "lucide-react";
import { toast } from "@/lib/toast-stub";

interface CredentialsBadgeProps {
  data: {
    email?: string;
    username?: string;
    password?: string;
    passcode?: string;
    ident_link?: string;
    info?: string;
    image_url?: string;
  };
  taskId?: string;
}

export const CredentialsBadge = ({ data, taskId }: CredentialsBadgeProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (value: string, fieldName: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(fieldName);
    toast.success("Kopiert!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const hasAnyData = data.email || data.username || data.password || data.passcode || data.ident_link;

  if (!hasAnyData) return null;

  // Generate barcode-like stripes
  const barcodePattern = Array.from({ length: 40 }, () => 
    Math.random() > 0.5 ? "w-[2px]" : "w-[1px]"
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl border border-slate-700/50">
      {/* Holographic accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-500" />
      
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255,255,255,0.03) 10px,
            rgba(255,255,255,0.03) 20px
          )`
        }} />
      </div>

      {/* Header */}
      <div className="relative px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                Autorisierte Zugangsdaten
              </h3>
              <p className="text-xs text-slate-500">Vertraulich • Nur für Sie bestimmt</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Aktiv</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative p-6">
        <div className="flex gap-6">
          {/* Photo/Avatar Section */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="w-24 h-28 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 overflow-hidden shadow-inner">
                {data.image_url ? (
                  <img 
                    src={data.image_url} 
                    alt="Profilbild" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-10 w-10 text-slate-500" />
                  </div>
                )}
              </div>
              {/* Photo frame decoration */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-sm" />
            </div>
          </div>

          {/* Credentials Grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.email && (
              <CredentialField
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={data.email}
                onCopy={() => copyToClipboard(data.email!, "email")}
                isCopied={copiedField === "email"}
              />
            )}
            {data.username && (
              <CredentialField
                icon={<User className="h-4 w-4" />}
                label="Benutzername"
                value={data.username}
                onCopy={() => copyToClipboard(data.username!, "username")}
                isCopied={copiedField === "username"}
              />
            )}
            {data.password && (
              <CredentialField
                icon={<Lock className="h-4 w-4" />}
                label="Passwort"
                value={data.password}
                onCopy={() => copyToClipboard(data.password!, "password")}
                isCopied={copiedField === "password"}
              />
            )}
            {data.passcode && (
              <CredentialField
                icon={<KeyRound className="h-4 w-4" />}
                label="Passcode"
                value={data.passcode}
                onCopy={() => copyToClipboard(data.passcode!, "passcode")}
                isCopied={copiedField === "passcode"}
              />
            )}
            {data.ident_link && (
              <div className="sm:col-span-2">
                <CredentialField
                  icon={<Link2 className="h-4 w-4" />}
                  label="Ident-Link"
                  value={data.ident_link}
                  isLink
                  onCopy={() => copyToClipboard(data.ident_link!, "ident_link")}
                  isCopied={copiedField === "ident_link"}
                />
              </div>
            )}
          </div>
        </div>

        {/* Additional Info Section */}
        {data.info && (
          <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Hinweise</span>
                <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{data.info}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Barcode */}
      <div className="relative px-6 py-4 border-t border-slate-700/50 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 h-8">
            {barcodePattern.map((width, i) => (
              <div 
                key={i} 
                className={`${width} h-full bg-slate-500 rounded-sm`}
                style={{ opacity: 0.3 + Math.random() * 0.4 }}
              />
            ))}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Referenz-ID</p>
            <p className="text-xs font-mono text-slate-400">
              {taskId ? `TSK-${taskId.slice(0, 8).toUpperCase()}` : "TSK-00000000"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CredentialFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLink?: boolean;
  onCopy: () => void;
  isCopied: boolean;
}

const CredentialField = ({ icon, label, value, isLink, onCopy, isCopied }: CredentialFieldProps) => {
  return (
    <div className="group relative">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="relative flex items-center">
        <div className="flex-1 px-3 py-2 rounded-md bg-slate-800/80 border border-slate-700/50 font-mono text-sm text-slate-200 truncate pr-10">
          {isLink ? (
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              {value.length > 40 ? value.slice(0, 40) + "..." : value}
            </a>
          ) : (
            value
          )}
        </div>
        <button
          onClick={onCopy}
          className="absolute right-2 p-1.5 rounded-md hover:bg-slate-700 transition-colors"
          title="Kopieren"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4 text-slate-400 group-hover:text-slate-200" />
          )}
        </button>
      </div>
    </div>
  );
};
