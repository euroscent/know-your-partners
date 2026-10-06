import { useState, useEffect } from "react";
import { PageLoader } from "@/components/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, RefreshCw, ShoppingCart, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/lib/toast-stub";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import SmsDebugPanel from "@/components/admin/SmsDebugPanel";

interface PhoneNumber {
  id: string;
  phone_number: string;
  provider: string | null;
  monthly_cost: number | null;
  assigned_to: string | null;
  status: string;
  rented_since: string | null;
  notes: string | null;
  country: string | null;
  rental_duration_days: number | null;
  setup_fee: number | null;
  available_numbers: number | null;
  number_type: string | null;
  service_name: string | null;
  rent_type: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const PhoneNumbers = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRentDialogOpen, setIsRentDialogOpen] = useState(false);
  const [isRentServiceDialogOpen, setIsRentServiceDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<PhoneNumber | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [renting, setRenting] = useState(false);
  const [rentingService, setRentingService] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    phone_number: "",
    provider: "",
    monthly_cost: "",
    assigned_to: "unassigned",
    status: "available",
    rented_since: "",
    notes: "",
    country: "",
    rental_duration_days: "",
    setup_fee: "",
    available_numbers: "",
    number_type: "",
  });

  const [rentFormData, setRentFormData] = useState({
    country: "Deutschland",
    rental_duration_days: "30",
    number_type: "mobile",
  });

  const [rentServiceFormData, setRentServiceFormData] = useState({
    country: "Deutschland",
    rental_duration_days: "30",
    service_name: "",
    provider: "beliebig",
  });

  const [orderFormData, setOrderFormData] = useState({
    productId: "",
    amount: "1",
    providerId: "",
  });

  // Map German country names to API country names
  const countryMapping: Record<string, string> = {
    "Deutschland": "Germany",
    "Spanien": "Spain",
    "USA": "USA",
    "Tschechien": "CzechRepublic",
    "Niederlande": "Netherlands",
    "Ukraine": "Ukraine",
    "Großbritannien": "UnitedKingdom",
    "Frankreich": "France",
    "Italien": "Italy",
    "Polen": "Poland",
    "Russland": "Russia",
    "China": "China",
    "Indien": "India",
    "Brasilien": "Brazil",
    "Kanada": "Canada",
  };

  // Calculate remaining days for rental
  const getRemainingDays = (rentedSince: string | null, durationDays: number | null): number | null => {
    if (!rentedSince || !durationDays) return null;
    
    const rentDate = new Date(rentedSince);
    if (isNaN(rentDate.getTime())) return null; // Check if date is invalid
    
    const expiryDate = new Date(rentDate);
    expiryDate.setDate(expiryDate.getDate() + durationDays);
    
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getRemainingDaysBadgeClass = (days: number | null): string => {
    if (days === null) return '';
    if (days <= 0) return 'bg-red-100 text-red-800';
    if (days <= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const [productSearchData, setProductSearchData] = useState({
    country: "all",
    countryId: "",
    rentalType: "all", // Default: Alle Typen
    serviceFilter: "", // Filter für Services
  });
  
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availableCountries, setAvailableCountries] = useState<{ id: number; country: string }[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [extending, setExtending] = useState(false);
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [loadingSms, setLoadingSms] = useState(false);

  useEffect(() => {
    fetchPhoneNumbers();
    fetchProfiles();
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    setLoadingCountries(true);
    try {
      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: { action: 'getCountries', data: {} },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Fehler beim Laden der Länder');

      const countries = data.data || [];
      console.log('[Countries] Loaded from API:', countries);
      setAvailableCountries(countries);
    } catch (err: any) {
      console.error('[Countries] Load error:', err);
      // Don't show toast - silently fail and use fallback
    } finally {
      setLoadingCountries(false);
    }
  };

  const fetchPhoneNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select(`
          *,
          profiles:assigned_to (
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPhoneNumbers(data || []);
    } catch (error: any) {
      toast({
        title: "Fehler beim Laden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dataToInsert = {
        phone_number: formData.phone_number,
        provider: formData.provider || null,
        monthly_cost: formData.monthly_cost ? parseFloat(formData.monthly_cost) : null,
        assigned_to: formData.assigned_to === "unassigned" ? null : formData.assigned_to || null,
        status: formData.status,
        rented_since: formData.rented_since || null,
        notes: formData.notes || null,
        country: formData.country || null,
        rental_duration_days: formData.rental_duration_days ? parseInt(formData.rental_duration_days) : null,
        setup_fee: formData.setup_fee ? parseFloat(formData.setup_fee) : null,
        available_numbers: formData.available_numbers ? parseInt(formData.available_numbers) : null,
        number_type: formData.number_type || null,
      };

      const { error } = await supabase
        .from("phone_numbers")
        .insert([dataToInsert]);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Telefonnummer wurde hinzugefügt",
      });

      setIsAddDialogOpen(false);
      resetForm();
      fetchPhoneNumbers();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNumber) return;

    try {
      const dataToUpdate = {
        phone_number: formData.phone_number,
        provider: formData.provider || null,
        monthly_cost: formData.monthly_cost ? parseFloat(formData.monthly_cost) : null,
        assigned_to: formData.assigned_to === "unassigned" ? null : formData.assigned_to || null,
        status: formData.status,
        rented_since: formData.rented_since || null,
        notes: formData.notes || null,
        country: formData.country || null,
        rental_duration_days: formData.rental_duration_days ? parseInt(formData.rental_duration_days) : null,
        setup_fee: formData.setup_fee ? parseFloat(formData.setup_fee) : null,
        available_numbers: formData.available_numbers ? parseInt(formData.available_numbers) : null,
        number_type: formData.number_type || null,
      } as any;

      const { error } = await supabase
        .from("phone_numbers")
        .update(dataToUpdate)
        .eq("id", editingNumber.id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Telefonnummer wurde aktualisiert",
      });

      setIsEditDialogOpen(false);
      setEditingNumber(null);
      resetForm();
      fetchPhoneNumbers();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diese Telefonnummer wirklich löschen?")) return;

    try {
      const { error } = await supabase
        .from("phone_numbers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Telefonnummer wurde gelöscht",
      });

      fetchPhoneNumbers();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExtendRental = async () => {
    if (!editingNumber || !formData.rental_duration_days) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Leihdauer",
        variant: "destructive",
      });
      return;
    }

    setExtending(true);

    try {
      // Extract booking information from notes
      const bookingIdMatch = editingNumber.notes?.match(/Booking ID: (\d+)/);
      
      if (!bookingIdMatch) {
        throw new Error("Keine Booking ID gefunden. Verlängerung nur für Anosim-Nummern möglich.");
      }

      const bookingId = bookingIdMatch[1];
      const durationInMinutes = parseInt(formData.rental_duration_days) * 1440; // Convert days to minutes

      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'extendBooking',
          data: {
            bookingId: parseInt(bookingId),
            durationInMinutes: durationInMinutes,
          },
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Fehler beim Verlängern der Miete');
      }

      toast({
        title: "Erfolgreich",
        description: `Miete wurde um ${formData.rental_duration_days} Tage verlängert`,
      });

      fetchPhoneNumbers();
      setIsEditDialogOpen(false);
    } catch (error: any) {
      console.error('Extend error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Konnte Miete nicht verlängern",
        variant: "destructive",
      });
    } finally {
      setExtending(false);
    }
  };

  const handleRentFromAnosim = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenting(true);

    try {
      // VERALTET: Die alten Endpunkte existieren nicht mehr
      // Wir verwenden jetzt die neue API: Produkte laden, dann Order erstellen
      toast({
        title: "Hinweis",
        description: "Diese Funktion wurde durch die neue Order-basierte API ersetzt. Bitte verwenden Sie 'Produkt bestellen'.",
        variant: "destructive",
      });

      setIsRentDialogOpen(false);
    } catch (error: any) {
      console.error('Rent error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Konnte Nummer nicht von Anosim mieten",
        variant: "destructive",
      });
    } finally {
      setRenting(false);
    }
  };

  const handleSyncWithAnosim = async () => {
    setSyncing(true);

    try {
      // Sync active bookings from Anosim
      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'getOrderBookings',
          data: {},
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Fehler beim Synchronisieren');
      }

      const bookings = data.data || [];

      if (bookings.length > 0) {
        const rows = bookings.map((booking: any) => ({
          phone_number: booking.number,
          provider: 'Anosim',
          country: booking.country,
          status: 'assigned',
          rented_since: new Date(booking.startDate).toISOString().split('T')[0],
          monthly_cost: parseFloat(booking.priceInUSD),
          rental_duration_days: Math.floor((booking.durationInMinutes || 0) / 1440),
          number_type: 'mobile',
          rent_type: booking.rentalType === 'RentalFull' ? 'full_number' : 'service',
          service_name: booking.service || null,
          notes: `Booking ID: ${booking.id}, End Date: ${booking.endDate}`,
        }));

        const { error: insertError } = await supabase
          .from('phone_numbers')
          .insert(rows);

        if (insertError) {
          console.error('Sync insert error:', insertError);
          throw new Error(`Konnte Nummern nicht speichern: ${insertError.message}`);
        }
      }

      toast({
        title: "Erfolgreich",
        description: `${bookings.length} aktive Buchungen synchronisiert`,
      });

      fetchPhoneNumbers();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Konnte nicht mit Anosim synchronisieren",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenting(true);
    try {
      const productId = parseInt(orderFormData.productId);
      const amount = parseInt(orderFormData.amount || '1') || 1;
      const providerId = orderFormData.providerId ? parseInt(orderFormData.providerId) : 0;

      if (!productId) throw new Error('Produkt-ID ist erforderlich');

      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'createOrder',
          data: { productId, amount, providerId },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Fehler beim Erstellen der Bestellung');

      console.log('Order response:', data);

      // Save phone numbers to database
      if (data.data?.orderBookings && data.data.orderBookings.length > 0) {
        console.log('Saving phone numbers to database:', data.data.orderBookings);
        
        const phoneNumbersToInsert = data.data.orderBookings.map((booking: any) => ({
          phone_number: booking.number,
          provider: 'Anosim',
          country: booking.country,
          status: 'assigned',
          rented_since: new Date(booking.startDate).toISOString().split('T')[0],
          monthly_cost: parseFloat(booking.priceInUSD),
          rental_duration_days: Math.floor(booking.durationInMinutes / 1440), // Convert minutes to days
          number_type: 'mobile', // conform to CHECK constraint: allowed values are local|mobile|toll-free|national
          rent_type: booking.rentalType === 'RentalFull' ? 'full_number' : 'service',
          service_name: booking.service || null,
          notes: `Order ID: ${data.data.id}, Booking ID: ${booking.id}, Service: ${booking.service || 'N/A'}, End Date: ${booking.endDate}`,
        }));

        console.log('Inserting phone numbers:', phoneNumbersToInsert);

        const { data: insertData, error: insertError } = await supabase
          .from('phone_numbers')
          .insert(phoneNumbersToInsert)
          .select();

        if (insertError) {
          console.error('Error saving phone numbers:', insertError);
          toast({
            title: 'Warnung',
            description: `Bestellung erfolgreich, aber Nummer konnte nicht gespeichert werden: ${insertError.message}`,
            variant: 'destructive',
          });
        } else {
          console.log('Phone numbers saved successfully:', insertData);
        }
      } else {
        console.warn('No order bookings in response');
      }

      toast({
        title: 'Erfolgreich',
        description: `Bestellung erstellt und ${data.data?.orderBookings?.length || 0} Nummer(n) gespeichert`,
      });

      setIsRentDialogOpen(false);
      setSelectedProduct(null);
      setOrderFormData({ productId: '', amount: '1', providerId: '0' });
      
      // Refresh the phone numbers list
      await fetchPhoneNumbers();
    } catch (err: any) {
      console.error('Create order error:', err);
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setRenting(false);
    }
  };

  const handleLoadProducts = async () => {
    setLoadingProducts(true);
    try {
      console.log('[Products] Loading products from Anosim API...');
      
      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'getAvailableNumbers',
          data: { countryId: productSearchData.countryId || undefined },
        },
      });

      console.log('[Products] API Response:', { success: data?.success, count: data?.data?.length, error });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Fehler beim Laden der Produkte');

      const products = data.data || [];
      setAvailableProducts(products);
      
      // Log unique countries and rental types for debugging
      const uniqueCountries = [...new Set(products.map((p: any) => p.country))];
      const uniqueTypes = [...new Set(products.map((p: any) => p.rentalType))];
      console.log('[Products] Unique countries:', uniqueCountries);
      console.log('[Products] Unique rental types:', uniqueTypes);
      
      toast({
        title: 'Produkte geladen',
        description: `${products.length} Produkte gefunden`,
      });
    } catch (err: any) {
      console.error('[Products] Load error:', err);
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setOrderFormData({
      productId: String(product.id),
      amount: '1',
      providerId: '0',
    });
  };

  const handleRentService = async (e: React.FormEvent) => {
    e.preventDefault();
    setRentingService(true);

    try {
      // VERALTET: Die alten Endpunkte existieren nicht mehr
      // Wir verwenden jetzt die neue API: Produkte laden, dann Order erstellen
      toast({
        title: "Hinweis",
        description: "Diese Funktion wurde durch die neue Order-basierte API ersetzt. Bitte verwenden Sie 'Produkt bestellen'.",
        variant: "destructive",
      });

      setIsRentServiceDialogOpen(false);
    } catch (error: any) {
      console.error('Rent service error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Konnte Service nicht von Anosim mieten",
        variant: "destructive",
      });
    } finally {
      setRentingService(false);
    }
  };

  const resetForm = () => {
    setFormData({
      phone_number: "",
      provider: "",
      monthly_cost: "",
      assigned_to: "unassigned",
      status: "available",
      rented_since: "",
      notes: "",
      country: "",
      rental_duration_days: "",
      setup_fee: "",
      available_numbers: "",
      number_type: "",
    });
  };

  const fetchSmsForNumber = async (phoneNumber: PhoneNumber) => {
    setLoadingSms(true);
    setSmsMessages([]);
    
    try {
      // Extract booking ID from notes
      const bookingIdMatch = phoneNumber.notes?.match(/Booking ID: (\d+)/);
      const orderIdMatch = phoneNumber.notes?.match(/Order ID: (\d+)/);
      
      if (!bookingIdMatch || !orderIdMatch) {
        console.log('No Booking ID or Order ID found in notes');
        return;
      }

      const bookingId = bookingIdMatch[1];
      const orderId = orderIdMatch[1];

      const { data, error } = await supabase.functions.invoke('anosim-api', {
        body: {
          action: 'getSms',
          data: {
            orderId: parseInt(orderId),
            bookingId: parseInt(bookingId),
          },
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Fehler beim Abrufen der SMS');
      }

      // Get last 3 SMS
      const sms = data.data || [];
      setSmsMessages(sms.slice(-3).reverse());
    } catch (error: any) {
      console.error('SMS fetch error:', error);
      toast({
        title: "Hinweis",
        description: "Keine SMS verfügbar oder Fehler beim Abrufen",
      });
    } finally {
      setLoadingSms(false);
    }
  };

  const openEditDialog = (number: PhoneNumber) => {
    setEditingNumber(number);
    setFormData({
      phone_number: number.phone_number,
      provider: number.provider || "",
      monthly_cost: number.monthly_cost?.toString() || "",
      assigned_to: number.assigned_to || "unassigned",
      status: number.status,
      rented_since: number.rented_since || "",
      notes: number.notes || "",
      country: number.country || "",
      rental_duration_days: number.rental_duration_days?.toString() || "",
      setup_fee: number.setup_fee?.toString() || "",
      available_numbers: number.available_numbers?.toString() || "",
      number_type: number.number_type || "",
    });
    setIsEditDialogOpen(true);
    fetchSmsForNumber(number);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "available":
        return "bg-success/10 text-success";
      case "assigned":
        return "bg-primary/10 text-primary";
      case "inactive":
        return "bg-muted text-muted-foreground";
      default:
        return "";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Verfügbar";
      case "assigned":
        return "Zugewiesen";
      case "inactive":
        return "Inaktiv";
      default:
        return status;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Telefonnummern</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isRentDialogOpen} onOpenChange={setIsRentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Produkt bestellen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Produkt bestellen (Anosim)</DialogTitle>
                </DialogHeader>
                
                {!selectedProduct ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="rental_type">Typ</Label>
                      <Select 
                        value={productSearchData.rentalType} 
                        onValueChange={(value) => setProductSearchData({ ...productSearchData, rentalType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">📋 Alle Typen</SelectItem>
                          <SelectItem value="RentalFull">🔢 Ganze Nummer mieten</SelectItem>
                          <SelectItem value="RentalService">📱 Nummer für einzelne Services mieten</SelectItem>
                          <SelectItem value="Activation">⚡ Einmalige Aktivierung (kurz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="search_country">
                        Land {loadingCountries && <span className="text-xs text-muted-foreground">(laden...)</span>}
                      </Label>
                      <Select 
                        value={productSearchData.country} 
                        onValueChange={(value) => setProductSearchData({ ...productSearchData, country: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Alle Länder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🌍 Alle Länder</SelectItem>
                          {availableCountries.length > 0 ? (
                            availableCountries.map((c) => (
                              <SelectItem key={c.id} value={c.country}>
                                {c.country === 'Germany' ? '🇩🇪' : 
                                 c.country === 'CzechRepublic' ? '🇨🇿' : 
                                 c.country === 'USA' ? '🇺🇸' :
                                 c.country === 'Ukraine' ? '🇺🇦' :
                                 c.country === 'Lithuania' ? '🇱🇹' :
                                 c.country === 'Israel' ? '🇮🇱' :
                                 c.country === 'Mexico' ? '🇲🇽' :
                                 c.country === 'Spain' ? '🇪🇸' :
                                 c.country === 'France' ? '🇫🇷' :
                                 c.country === 'UnitedKingdom' ? '🇬🇧' :
                                 c.country === 'Netherlands' ? '🇳🇱' :
                                 c.country === 'Poland' ? '🇵🇱' :
                                 c.country === 'Italy' ? '🇮🇹' :
                                 c.country === 'Canada' ? '🇨🇦' :
                                 c.country === 'Brazil' ? '🇧🇷' :
                                 '🌐'} {c.country}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                              <SelectItem value="CzechRepublic">🇨🇿 CzechRepublic</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {productSearchData.rentalType === "RentalService" && (
                      <div>
                        <Label htmlFor="service_filter">Service suchen (optional)</Label>
                        <Input
                          id="service_filter"
                          placeholder="z.B. WhatsApp, Google, Tinder..."
                          value={productSearchData.serviceFilter}
                          onChange={(e) => setProductSearchData({ ...productSearchData, serviceFilter: e.target.value })}
                        />
                      </div>
                    )}

                    <Button onClick={handleLoadProducts} disabled={loadingProducts} className="w-full">
                      {loadingProducts ? 'Lade Produkte...' : 'Verfügbare Produkte laden'}
                    </Button>

                    {availableProducts.length > 0 && (() => {
                      const filteredProducts = availableProducts
                        .filter((p: any) => {
                          if (productSearchData.rentalType === "all") return true;
                          return p.rentalType === productSearchData.rentalType;
                        })
                        .filter((p: any) => {
                          if (productSearchData.country === "all") return true;
                          // Direct match with API country name
                          return p.country === productSearchData.country;
                        })
                        .filter((p: any) => {
                          if (!productSearchData.serviceFilter) return true;
                          return p.service?.toLowerCase().includes(productSearchData.serviceFilter.toLowerCase());
                        });
                      
                      return (
                        <div className="space-y-2">
                          <h3 className="font-semibold">Verfügbare Produkte ({filteredProducts.length})</h3>
                          
                          {filteredProducts.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground border rounded-lg">
                              <p>Keine Produkte mit diesen Filtern gefunden.</p>
                              <p className="text-xs mt-2">
                                Versuche andere Filter oder wähle "Alle Länder"
                              </p>
                            </div>
                          ) : (
                            <div className="max-h-[400px] overflow-y-auto space-y-2">
                              {filteredProducts.map((product: any) => (
                                <div 
                                  key={product.id} 
                                  className="p-3 border rounded-lg hover:bg-muted cursor-pointer"
                                  onClick={() => handleSelectProduct(product)}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="font-medium">{product.country} - {product.service || product.rentalType}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {product.durationInMinutes ? `${Math.round(product.durationInMinutes / 1440)} Tage` : 'Dauer unbekannt'}
                                      </p>
                                      {product.provider && product.provider.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Anbieter: {product.provider.map((p: any) => `${p.name} (${p.availableCount})`).join(', ')}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold">${product.price}</p>
                                      <p className="text-xs text-muted-foreground">Produkt-ID: {product.id}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsRentDialogOpen(false)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateOrder} className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="font-medium">{selectedProduct.country} - {selectedProduct.service || selectedProduct.rentalType}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedProduct.durationInMinutes ? `${Math.round(selectedProduct.durationInMinutes / 1440)} Tage` : 'Dauer unbekannt'} • ${selectedProduct.price}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Produkt-ID: {selectedProduct.id}</p>
                    </div>

                    <div>
                      <Label htmlFor="amount">Anzahl</Label>
                      <Input
                        id="amount"
                        type="number"
                        min={1}
                        value={orderFormData.amount}
                        onChange={(e) => setOrderFormData({ ...orderFormData, amount: e.target.value })}
                      />
                    </div>

                    {selectedProduct.provider && selectedProduct.provider.length > 1 && (
                      <div>
                        <Label htmlFor="provider_select">Anbieter</Label>
                        <Select 
                          value={orderFormData.providerId}
                          onValueChange={(value) => setOrderFormData({ ...orderFormData, providerId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedProduct.provider.map((p: any) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name} ({p.availableCount} verfügbar)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setSelectedProduct(null);
                          setAvailableProducts([]);
                        }}
                        disabled={renting}
                      >
                        Zurück
                      </Button>
                      <Button type="submit" disabled={renting}>
                        {renting ? 'Bestelle...' : 'Bestellen'}
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
          </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader variant="inline" />
          ) : phoneNumbers.length === 0 ? (
            <p className="text-muted-foreground">Noch keine Telefonnummern vorhanden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefonnummer</TableHead>
                  <TableHead>Land</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Anbieter</TableHead>
                  <TableHead>Kosten</TableHead>
                  <TableHead>Verbleibende Tage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zugewiesen an</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumbers.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-medium">{number.phone_number}</TableCell>
                    <TableCell>{number.country || "-"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        number.rent_type === 'service' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {number.rent_type === 'service' ? 'Service' : 'Ganze Nummer'}
                      </span>
                    </TableCell>
                    <TableCell>{number.service_name || "-"}</TableCell>
                    <TableCell>{number.provider || "-"}</TableCell>
                    <TableCell>
                      {number.monthly_cost ? `${number.monthly_cost.toFixed(2)} €` : "-"}
                      {number.rental_duration_days && ` / ${number.rental_duration_days}d`}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const remainingDays = getRemainingDays(number.rented_since, number.rental_duration_days);
                        if (remainingDays === null) return "-";
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getRemainingDaysBadgeClass(remainingDays)}`}>
                            {remainingDays <= 0 
                              ? 'Abgelaufen' 
                              : `${remainingDays} ${remainingDays === 1 ? 'Tag' : 'Tage'}`
                            }
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(number.status)}`}>
                        {getStatusLabel(number.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{number.profiles ? `${number.profiles.first_name} ${number.profiles.last_name}` : "-"}</span>
                        {number.notes && number.notes.includes("Ehem. zugewiesen") && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <HistoryIcon className="h-3 w-3" />
                            {number.notes.split("\n").filter((n: string) => n.includes("Ehem. zugewiesen")).pop()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(number)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(number.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SMS Debug Panel */}
      <SmsDebugPanel phoneNumbers={phoneNumbers} />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Telefonnummer bearbeiten</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_phone_number">Telefonnummer *</Label>
                <Input
                  id="edit_phone_number"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_country">Land</Label>
                <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Land wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deutschland">🇩🇪 Deutschland</SelectItem>
                    <SelectItem value="Spanien">🇪🇸 Spanien</SelectItem>
                    <SelectItem value="USA">🇺🇸 USA</SelectItem>
                    <SelectItem value="Hongkong">🇭🇰 Hongkong</SelectItem>
                    <SelectItem value="Israel">🇮🇱 Israel</SelectItem>
                    <SelectItem value="Mexiko">🇲🇽 Mexiko</SelectItem>
                    <SelectItem value="Niederlande">🇳🇱 Niederlande</SelectItem>
                    <SelectItem value="Österreich">🇦🇹 Österreich</SelectItem>
                    <SelectItem value="Schweiz">🇨🇭 Schweiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_rental_duration_days">Leihdauer (Tage)</Label>
                <Select value={formData.rental_duration_days} onValueChange={(value) => setFormData({ ...formData, rental_duration_days: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Dauer wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Tag</SelectItem>
                    <SelectItem value="7">7 Tage</SelectItem>
                    <SelectItem value="30">30 Tage</SelectItem>
                    <SelectItem value="90">90 Tage</SelectItem>
                    <SelectItem value="180">180 Tage</SelectItem>
                    <SelectItem value="360">360 Tage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_assigned_to">Zugewiesen an</Label>
                <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nicht zugewiesen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.first_name} {profile.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingNumber?.notes?.includes('Booking ID') && (
              <div className="border rounded-lg p-4 space-y-2">
                <Label className="text-sm font-medium">Letzte 3 SMS</Label>
                {loadingSms ? (
                  <p className="text-sm text-muted-foreground">Lade SMS...</p>
                ) : smsMessages.length > 0 ? (
                  <div className="space-y-2">
                    {smsMessages.map((sms, index) => (
                      <div key={index} className="bg-muted p-3 rounded text-sm">
                        <div className="font-medium">{sms.sender || 'Unbekannt'}</div>
                        <div className="text-muted-foreground mt-1">{sms.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(sms.receivedAt).toLocaleString('de-DE')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine SMS verfügbar</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleExtendRental}
                disabled={extending || !editingNumber?.notes?.includes('Booking ID')}
              >
                {extending ? 'Verlängere...' : 'Miete verlängern'}
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit">Aktualisieren</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhoneNumbers;
