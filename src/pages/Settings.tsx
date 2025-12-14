import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Database, AlertCircle } from "lucide-react";
import { exportAllData, importData } from "@/lib/backup";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await importData(file);
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
      e.target.value = '';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your data and application settings</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
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
                  onChange={handleImport}
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

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Warning: Importing data will add to existing data. Duplicate IDs may cause issues.
              </AlertDescription>
            </Alert>
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
      </div>
    </div>
  );
}
