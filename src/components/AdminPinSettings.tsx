import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-stub";
import { KeyRound } from "lucide-react";

export function AdminPinSettings() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,20}$/.test(newPin)) return toast.error("Neuer PIN: 4–20 Ziffern");
    if (newPin !== confirm) return toast.error("Die neuen PINs stimmen nicht überein");
    setLoading(true);
    const { error } = await (supabase as any).rpc("change_admin_pin", { _old_pin: oldPin, _new_pin: newPin });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("PIN geändert");
    setOldPin(""); setNewPin(""); setConfirm("");
  };

  const pinInput = (id: string, v: string, set: (s: string) => void) => (
    <Input id={id} type="password" inputMode="numeric" autoComplete="off" value={v}
      onChange={(e) => set(e.target.value.replace(/\D/g, ""))} required />
  );

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Admin-PIN</CardTitle>
        <CardDescription>Mit diesem PIN wird der Admin-Bereich entsperrt.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="op">Aktueller PIN</Label>{pinInput("op", oldPin, setOldPin)}</div>
          <div className="space-y-2"><Label htmlFor="np">Neuer PIN</Label>{pinInput("np", newPin, setNewPin)}</div>
          <div className="space-y-2"><Label htmlFor="cp">Neuen PIN wiederholen</Label>{pinInput("cp", confirm, setConfirm)}</div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Wird gespeichert…" : "PIN ändern"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
