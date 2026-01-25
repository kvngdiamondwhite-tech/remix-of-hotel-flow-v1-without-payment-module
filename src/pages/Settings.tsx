import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, Database, AlertCircle, Building2, Image, X, CreditCard, Clock, FileText, Settings2, Plus, Trash2, Edit2, Check, Key, Shield, Copy } from "lucide-react";
import { exportAllData, importData, hasExistingData, clearAllData } from "@/lib/backup";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import { SUPPORTED_CURRENCIES, PAYMENT_METHOD_COLORS, HotelSettings, PaymentMethodConfig, DEFAULT_PAYMENT_METHODS } from "@/lib/settings";
import { uid } from "@/lib/id";
import { ImportConfirmationModal, ImportMode } from "@/components/ImportConfirmationModal";
import { useLicense } from "@/hooks/useLicense";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { TRIAL_LIMITS } from "@/lib/license";

export default function Settings() {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const { settings, updateSettings } = useSettings();
  const license = useLicense();
  const [licenseKey, setLicenseKey] = useState("");
  const [formData, setFormData] = useState<HotelSettings>(settings);
  const [logoPreview, setLogoPreview] = useState<string>(settings.logo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  
  // Payment method editing state
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editingMethodName, setEditingMethodName] = useState("");
  const [editingMethodColor, setEditingMethodColor] = useState("");
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodColor, setNewMethodColor] = useState(PAYMENT_METHOD_COLORS[0].value);

  // Import modal state (TASK 3)
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [existingDataCheck, setExistingDataCheck] = useState(false);

  // Sync form data when settings load
  useEffect(() => {
    setFormData(settings);
    setLogoPreview(settings.logo);
  }, [settings]);

  // Apply dark mode when settings change
  useEffect(() => {
    if (formData.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [formData.darkMode]);

  const handleExport = async () => {
    try {
      await exportAllData();
      toast({
        title: "Success",
        description: "Data exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  // Handle file selection - opens confirmation modal (TASK 3)
  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if data exists before showing modal
    const dataExists = await hasExistingData();
    setExistingDataCheck(dataExists);
    setPendingImportFile(file);
    setShowImportModal(true);
    
    // Reset file input
    e.target.value = '';
  };

  // Handle import confirmation (TASK 3)
  const handleImportConfirm = async (mode: ImportMode) => {
    if (!pendingImportFile) return;

    // If empty-only mode and data exists, block import
    if (mode === 'empty-only' && existingDataCheck) {
      toast({
        title: "Import Blocked",
        description: "Existing data detected. Please clear data first or choose 'Clear existing data before import'.",
        variant: "destructive",
      });
      setShowImportModal(false);
      setPendingImportFile(null);
      return;
    }

    setImporting(true);
    setShowImportModal(false);

    try {
      // Clear data if requested
      if (mode === 'clear-first') {
        await clearAllData();
      }

      const result = await importData(pendingImportFile);
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setPendingImportFile(null);
    }
  };

  const handleImportCancel = () => {
    setShowImportModal(false);
    setPendingImportFile(null);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 500 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 500KB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoPreview(base64);
      setFormData(prev => ({ ...prev, logo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview('');
    setFormData(prev => ({ ...prev, logo: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    try {
      updateSettings(formData);
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof HotelSettings, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Payment method handlers
  const handleAddPaymentMethod = () => {
    if (!newMethodName.trim()) {
      toast({ title: "Error", description: "Please enter a method name", variant: "destructive" });
      return;
    }
    const newMethod: PaymentMethodConfig = {
      id: uid(),
      name: newMethodName.trim(),
      enabled: true,
      color: newMethodColor, // Include selected color
    };
    setFormData(prev => ({
      ...prev,
      paymentMethods: [...prev.paymentMethods, newMethod],
    }));
    setNewMethodName("");
    setNewMethodColor(PAYMENT_METHOD_COLORS[0].value); // Reset to default color
  };

  const handleTogglePaymentMethod = (id: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(pm =>
        pm.id === id ? { ...pm, enabled: !pm.enabled } : pm
      ),
    }));
  };

  const handleDeletePaymentMethod = (id: string) => {
    // Don't allow deleting the last payment method
    if (formData.paymentMethods.length <= 1) {
      toast({ title: "Error", description: "At least one payment method is required", variant: "destructive" });
      return;
    }
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter(pm => pm.id !== id),
    }));
  };

  const handleEditPaymentMethod = (pm: PaymentMethodConfig) => {
    setEditingMethodId(pm.id);
    setEditingMethodName(pm.name);
    setEditingMethodColor(pm.color || PAYMENT_METHOD_COLORS[0].value); // Use method's color or default
  };

  const handleSavePaymentMethodName = () => {
    if (!editingMethodName.trim()) {
      toast({ title: "Error", description: "Method name cannot be empty", variant: "destructive" });
      return;
    }
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(pm =>
        pm.id === editingMethodId ? { ...pm, name: editingMethodName.trim(), color: editingMethodColor } : pm
      ),
    }));
    setEditingMethodId(null);
    setEditingMethodName("");
    setEditingMethodColor("");
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your data and application settings</p>
      </div>

      <Tabs defaultValue="license" className="max-w-3xl">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="license">
            <Key className="h-4 w-4 mr-2" />
            License
          </TabsTrigger>
          <TabsTrigger value="profile">
            <Building2 className="h-4 w-4 mr-2" />
            Business Profile
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Settings
          </TabsTrigger>
          <TabsTrigger value="booking">
            <Clock className="h-4 w-4 mr-2" />
            Booking Rules
          </TabsTrigger>
          <TabsTrigger value="receipt">
            <FileText className="h-4 w-4 mr-2" />
            Receipt & Printing
          </TabsTrigger>
          <TabsTrigger value="system">
            <Settings2 className="h-4 w-4 mr-2" />
            System Preferences
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="h-4 w-4 mr-2" />
            Backup & Restore
          </TabsTrigger>
        </TabsList>

        {/* License / Activation Tab */}
        <TabsContent value="license" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>License & Activation</CardTitle>
                </div>
                <Badge 
                  className={
                    license.isActive ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                    license.isTrial ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" :
                    "bg-red-500/20 text-red-700 dark:text-red-400"
                  }
                >
                  {license.stateLabel}
                </Badge>
              </div>
              <CardDescription>
                Manage your software license and view activation status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* App Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">App Version</p>
                  <p className="font-semibold">1.0.0</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">License Status</p>
                  <p className="font-semibold">{license.stateLabel}</p>
                </div>
              </div>

              {/* Machine ID */}
              <div className="space-y-2">
                <Label>Machine ID</Label>
                <div className="flex gap-2">
                  <Input 
                    value={license.machineId} 
                    readOnly 
                    className="font-mono bg-muted"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(license.machineId);
                      toast({ title: "Copied", description: "Machine ID copied to clipboard" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Provide this ID when requesting a license key
                </p>
              </div>

              {/* License Status Details */}
              {license.isActive && (
                <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Shield className="h-5 w-5" />
                    <span className="font-semibold">License Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Activated On</p>
                      <p className="font-medium">{license.activationDate ? formatDate(license.activationDate) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires On</p>
                      <p className="font-medium">{license.expiryDate ? formatDate(license.expiryDate) : 'N/A'}</p>
                    </div>
                  </div>
                  {license.daysRemaining !== null && license.daysRemaining <= 30 && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your license expires in {license.daysRemaining} days. Contact support for renewal.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {license.isTrial && (
                <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold">Trial Mode</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Bookings: {license.trialBookingsUsed} / {TRIAL_LIMITS.maxBookings} used</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${(license.trialBookingsUsed / TRIAL_LIMITS.maxBookings) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trial limitations: Reports, Backup/Import, and Customization are disabled. Receipts show watermark.
                  </p>
                </div>
              )}

              {license.isExpired && (
                <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">License Expired</span>
                  </div>
                  <p className="text-sm">
                    Your license expired on {license.expiryDate ? formatDate(license.expiryDate) : 'N/A'}. 
                    You can still view data and export backups. Enter a renewal key below to restore full access.
                  </p>
                </div>
              )}

              {license.isInvalid && (
                <div className="p-4 border border-red-600/30 bg-red-600/5 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Invalid License</span>
                  </div>
                  <p className="text-sm">
                    The stored license is not valid for this device. Please contact support for assistance.
                  </p>
                </div>
              )}

              {/* Activation Key Input */}
              <div className="space-y-2">
                <Label htmlFor="licenseKey">
                  {license.isActive ? "Renewal Key" : "Activation Key"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="licenseKey"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="HMS-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXX"
                    className="font-mono"
                  />
                  <Button 
                    onClick={() => {
                      const result = license.activate(licenseKey);
                      if (!result.success) {
                        toast({ 
                          title: "Activation Failed", 
                          description: result.error,
                          variant: "destructive"
                        });
                      } else {
                        setLicenseKey("");
                      }
                    }}
                    disabled={!licenseKey.trim()}
                  >
                    {license.isActive ? "Renew" : "Activate"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the license key provided by your software vendor
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>
                Configure your hotel or business information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Hotel logo preview"
                        className="h-20 w-20 object-contain rounded-lg border bg-muted"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={handleRemoveLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted">
                      <Image className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 500KB. PNG, JPG, or SVG
                    </p>
                  </div>
                </div>
              </div>

              {/* Hotel Name */}
              <div className="space-y-2">
                <Label htmlFor="hotelName">Hotel / Business Name</Label>
                <Input
                  id="hotelName"
                  value={formData.hotelName}
                  onChange={(e) => handleInputChange('hotelName', e.target.value)}
                  placeholder="Enter hotel name"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter business address"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => handleInputChange('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} - {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This currency will be used across all payments, reports, and receipts
                </p>
              </div>

              <Button onClick={handleSave} className="w-full">
                Save Business Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings Tab */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Manage available payment methods. Disabled methods won't appear in payment forms but historical records remain unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing payment methods */}
              <div className="space-y-2">
                {formData.paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    {editingMethodId === pm.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingMethodName}
                          onChange={(e) => setEditingMethodName(e.target.value)}
                          className="h-8 flex-1"
                          autoFocus
                        />
                        {/* Color picker for payment method */}
                        <Select value={editingMethodColor} onValueChange={setEditingMethodColor}>
                          <SelectTrigger className="w-32 h-8">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: editingMethodColor }}
                              />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHOD_COLORS.map((colorOption) => (
                              <SelectItem key={colorOption.value} value={colorOption.value}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded-full border"
                                    style={{ backgroundColor: colorOption.value }}
                                  />
                                  {colorOption.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={handleSavePaymentMethodName}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingMethodId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={pm.enabled}
                            onCheckedChange={() => handleTogglePaymentMethod(pm.id)}
                          />
                          {/* Color indicator for payment method */}
                          <div 
                            className="w-4 h-4 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: pm.color || '#6b7280' }}
                            title={`Color: ${pm.color || 'default'}`}
                          />
                          <span className={pm.enabled ? "font-medium" : "text-muted-foreground line-through"}>
                            {pm.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEditPaymentMethod(pm)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeletePaymentMethod(pm.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new payment method */}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="New payment method name..."
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPaymentMethod()}
                  className="flex-1"
                />
                {/* Color picker for new payment method */}
                <Select value={newMethodColor} onValueChange={setNewMethodColor}>
                  <SelectTrigger className="w-32">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: newMethodColor }}
                      />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_COLORS.map((colorOption) => (
                      <SelectItem key={colorOption.value} value={colorOption.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: colorOption.value }}
                          />
                          {colorOption.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddPaymentMethod} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Historical payment records will not be affected when you modify or disable payment methods.
                </AlertDescription>
              </Alert>

              <Button onClick={handleSave} className="w-full">
                Save Payment Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Rules Tab */}
        <TabsContent value="booking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Debt Control</CardTitle>
              <CardDescription>
                Configure whether bookings can have outstanding balances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Allow Debt / Outstanding Balances</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    When disabled, new bookings will require full payment. Existing debt records remain unchanged.
                  </p>
                </div>
                <Switch
                  checked={formData.allowDebt}
                  onCheckedChange={(checked) => handleInputChange('allowDebt', checked)}
                />
              </div>

              {!formData.allowDebt && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    New bookings will require full payment before checkout. Partial payments and outstanding balances will be blocked.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Booking Times</CardTitle>
              <CardDescription>
                Set default check-in and check-out times. These will pre-fill booking forms but can be edited per booking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkInTime">Default Check-in Time</Label>
                  <Input
                    id="checkInTime"
                    type="time"
                    value={formData.defaultCheckInTime}
                    onChange={(e) => handleInputChange('defaultCheckInTime', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOutTime">Default Check-out Time</Label>
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={formData.defaultCheckOutTime}
                    onChange={(e) => handleInputChange('defaultCheckOutTime', e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleSave} className="w-full">
                Save Booking Rules
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt & Printing Tab */}
        <TabsContent value="receipt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Footer</CardTitle>
              <CardDescription>
                Customize the footer text that appears on payment receipts, booking invoices, and printed reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiptFooter">Footer Text</Label>
                <Textarea
                  id="receiptFooter"
                  value={formData.receiptFooter}
                  onChange={(e) => handleInputChange('receiptFooter', e.target.value)}
                  placeholder="Enter footer text for receipts..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Supports multiple lines. Use line breaks for formatting.
                </p>
              </div>

              {/* Preview */}
              {formData.receiptFooter && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <div className="text-sm text-center whitespace-pre-line">
                    {formData.receiptFooter}
                  </div>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">
                Save Receipt Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Preferences Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Delete Behavior</CardTitle>
              <CardDescription>
                Control how deletions are handled in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Soft Delete Mode</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    When enabled, delete actions will be replaced with Cancel/Void. Records will be marked but not permanently removed.
                  </p>
                </div>
                <Switch
                  checked={formData.softDeleteMode}
                  onCheckedChange={(checked) => handleInputChange('softDeleteMode', checked)}
                />
              </div>

              {formData.softDeleteMode && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Bookings and payments will be cancelled/voided instead of deleted. This helps maintain audit trails.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toggle between light and dark theme. Your preference will be saved locally.
                  </p>
                </div>
                <Switch
                  checked={formData.darkMode}
                  onCheckedChange={(checked) => handleInputChange('darkMode', checked)}
                />
              </div>

              <Button onClick={handleSave} className="w-full">
                Save System Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup & Restore Tab */}
        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Data Backup & Restore</CardTitle>
              </div>
              <CardDescription>
                Export or import all your hotel data as JSON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your data is stored locally in your browser. Regular backups are recommended.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-3">
                <Button onClick={handleExport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export All Data
                </Button>

                <div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFileSelect}
                    disabled={importing}
                    id="import-file"
                    className="hidden"
                  />
                  <Button
                    onClick={() => document.getElementById('import-file')?.click()}
                    variant="outline"
                    className="w-full"
                    disabled={importing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {importing ? 'Importing...' : 'Import Data'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offline Mode</CardTitle>
              <CardDescription>
                This app works completely offline using your browser's storage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ All data stored locally in IndexedDB</p>
                <p>✓ No internet connection required</p>
                <p>✓ Works as a Progressive Web App (PWA)</p>
                <p>✓ Install to home screen on mobile devices</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Confirmation Modal (TASK 3) */}
      <ImportConfirmationModal
        open={showImportModal}
        onClose={handleImportCancel}
        onConfirm={handleImportConfirm}
        hasExistingData={existingDataCheck}
      />
    </div>
  );
}
