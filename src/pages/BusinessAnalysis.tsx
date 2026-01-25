import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAllItems, Booking, Expenditure } from "@/lib/db";
import { getAllPayments, Payment } from "@/lib/payments";
import { formatCurrency } from "@/lib/calculations";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Printer } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

interface AnalysisData {
  bookings: Booking[];
  payments: Payment[];
  expenditures: Expenditure[];
}

export default function BusinessAnalysis() {
  const { settings } = useSettings();
  const [data, setData] = useState<AnalysisData>({
    bookings: [],
    payments: [],
    expenditures: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bookings, payments, expenditures] = await Promise.all([
        getAllItems<Booking>("bookings"),
        getAllPayments(),
        getAllItems<Expenditure>("expenditures"),
      ]);
      setData({ bookings, payments, expenditures });
    } catch (error) {
      console.error("Failed to load analysis data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate total revenue from all payments
  const totalRevenue = useMemo(() => {
    return data.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [data.payments]);

  // Calculate total expenditures from all expense records
  const totalExpenditures = useMemo(() => {
    return data.expenditures.reduce((sum, exp) => sum + exp.amount, 0);
  }, [data.expenditures]);

  // Calculate gross profit
  const grossProfit = useMemo(() => {
    return totalRevenue - totalExpenditures;
  }, [totalRevenue, totalExpenditures]);

  // Calculate profit margin percentage
  const profitMargin = useMemo(() => {
    if (totalRevenue === 0) return 0;
    return (grossProfit / totalRevenue) * 100;
  }, [grossProfit, totalRevenue]);

  // Calculate metrics by category
  const expendituresByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    data.expenditures.forEach((exp) => {
      categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
    });
    return Object.entries(categories)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.expenditures]);

  // Calculate booking and payment statistics
  const bookingStats = useMemo(() => {
    const totalBookings = data.bookings.length;
    const totalBookedAmount = data.bookings.reduce((sum, b) => sum + b.total, 0);
    const paidAmount = totalRevenue;
    const unpaidAmount = totalBookedAmount - paidAmount;

    return {
      totalBookings,
      totalBookedAmount,
      paidAmount,
      unpaidAmount,
      paymentRate: totalBookedAmount > 0 ? (paidAmount / totalBookedAmount) * 100 : 0,
    };
  }, [data.bookings, totalRevenue]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading analysis data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          {settings.logo && (
            <img src={settings.logo} alt="Hotel logo" className="h-12 w-12 object-contain rounded-lg" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Business Analysis Report</h1>
            <p className="text-muted-foreground mt-1">Comprehensive financial and operational analysis</p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline" className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Print Report
        </Button>
      </div>

      {/* Financial Overview - Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-200">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              {data.payments.length} payments received
            </p>
          </CardContent>
        </Card>

        {/* Total Expenditures */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Total Expenditures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-200">
              {formatCurrency(totalExpenditures)}
            </div>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              {data.expenditures.length} expense records
            </p>
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card className={`bg-gradient-to-br border-2 ${
          grossProfit >= 0
            ? "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800"
            : "from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800"
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${
              grossProfit >= 0
                ? "text-blue-900 dark:text-blue-100"
                : "text-orange-900 dark:text-orange-100"
            }`}>
              <BarChart3 className="h-4 w-4" />
              Gross Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              grossProfit >= 0
                ? "text-blue-700 dark:text-blue-200"
                : "text-orange-700 dark:text-orange-200"
            }`}>
              {formatCurrency(grossProfit)}
            </div>
            <p className={`text-xs mt-1 ${
              grossProfit >= 0
                ? "text-blue-600 dark:text-blue-300"
                : "text-orange-600 dark:text-orange-300"
            }`}>
              Revenue minus expenses
            </p>
          </CardContent>
        </Card>

        {/* Profit Margin */}
        <Card className={`bg-gradient-to-br border-2 ${
          profitMargin >= 20
            ? "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800"
            : profitMargin >= 0
            ? "from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800"
            : "from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 border-rose-200 dark:border-rose-800"
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${
              profitMargin >= 20
                ? "text-purple-900 dark:text-purple-100"
                : profitMargin >= 0
                ? "text-amber-900 dark:text-amber-100"
                : "text-rose-900 dark:text-rose-100"
            }`}>
              <TrendingUp className="h-4 w-4" />
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              profitMargin >= 20
                ? "text-purple-700 dark:text-purple-200"
                : profitMargin >= 0
                ? "text-amber-700 dark:text-amber-200"
                : "text-rose-700 dark:text-rose-200"
            }`}>
              {profitMargin.toFixed(2)}%
            </div>
            <p className={`text-xs mt-1 ${
              profitMargin >= 20
                ? "text-purple-600 dark:text-purple-300"
                : profitMargin >= 0
                ? "text-amber-600 dark:text-amber-300"
                : "text-rose-600 dark:text-rose-300"
            }`}>
              {profitMargin >= 20 ? "Excellent margin" : profitMargin >= 0 ? "Fair margin" : "Negative margin"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue & Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Total Bookings</span>
                <span className="font-semibold">{bookingStats.totalBookings}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Total Booked Amount</span>
                <span className="font-semibold">{formatCurrency(bookingStats.totalBookedAmount)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b bg-green-50 dark:bg-green-950 p-2 rounded">
                <span className="text-green-700 dark:text-green-100 font-medium">Amount Paid (Received)</span>
                <span className="font-bold text-green-700 dark:text-green-100">{formatCurrency(bookingStats.paidAmount)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b bg-orange-50 dark:bg-orange-950 p-2 rounded">
                <span className="text-orange-700 dark:text-orange-100 font-medium">Outstanding Amount</span>
                <span className="font-bold text-orange-700 dark:text-orange-100">{formatCurrency(bookingStats.unpaidAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-medium">Payment Collection Rate</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{bookingStats.paymentRate.toFixed(2)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenditure Breakdown by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Expenditures by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expendituresByCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No expenditures recorded yet</p>
            ) : (
              <div className="space-y-2">
                {expendituresByCategory.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center pb-2 border-b last:border-b-0">
                    <div>
                      <span className="text-muted-foreground text-sm">{item.category}</span>
                      <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded mt-1 overflow-hidden">
                        <div
                          className="h-full bg-red-500 dark:bg-red-400"
                          style={{
                            width: `${(item.amount / totalExpenditures) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="font-semibold">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t-2 font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(totalExpenditures)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics & Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-xs text-muted-foreground mb-1">Average Revenue per Booking</p>
              <p className="text-2xl font-bold">
                {formatCurrency(bookingStats.totalBookings > 0 ? totalRevenue / bookingStats.totalBookings : 0)}
              </p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <p className="text-xs text-muted-foreground mb-1">Average Expenditure per Record</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.expenditures.length > 0 ? totalExpenditures / data.expenditures.length : 0)}
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-xs text-muted-foreground mb-1">Profit per Booking</p>
              <p className="text-2xl font-bold">
                {formatCurrency(bookingStats.totalBookings > 0 ? grossProfit / bookingStats.totalBookings : 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality & Source Information */}
      <Card className="bg-muted/50 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Report Information</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>✓ This is a read-only analysis report using live data from all modules</p>
          <p>✓ Revenue data sourced from: All payments across all bookings</p>
          <p>✓ Expenditure data sourced from: All expense records by category</p>
          <p>✓ Report generated on: {new Date().toLocaleString()}</p>
          <p>✓ All calculations are performed in-memory and do not persist to database</p>
        </CardContent>
      </Card>
    </div>
  );
}
