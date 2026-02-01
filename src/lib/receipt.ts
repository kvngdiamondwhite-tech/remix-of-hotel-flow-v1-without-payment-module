import { Booking, Guest, Room, RoomType, BookingRoom } from './db';
import { Payment, getTotalPaidForBooking } from './payments';
import { formatDate, formatDateTime } from './dates';
import { formatCurrency } from './calculations';
import { getSettings } from './settings';

export function generateReceipt(
  booking: Booking,
  guest: Guest,
  room: Room,
  roomType: RoomType
): string {
  const settings = getSettings();
  // Convert receipt footer line breaks to HTML
  const footerHtml = settings.receiptFooter 
    ? settings.receiptFooter.split('\n').map(line => `<p>${line}</p>`).join('')
    : '';
    
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Receipt - ${booking.id}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #333;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h2 {
      color: #555;
      border-bottom: 2px solid #eee;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #666;
    }
    .value {
      color: #333;
    }
    .total-section {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 16px;
    }
    .total-row.grand-total {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      border-top: 2px solid #333;
      padding-top: 10px;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      color: #666;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    .custom-footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px dashed #ccc;
      white-space: pre-line;
    }
    .custom-footer p {
      margin: 3px 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;" />` : ''}
    <h1>${settings.hotelName}</h1>
    ${settings.address ? `<p style="margin: 5px 0; color: #666;">${settings.address}</p>` : ''}
    ${settings.phone || settings.email ? `<p style="margin: 5px 0; color: #666;">${[settings.phone, settings.email].filter(Boolean).join(' | ')}</p>` : ''}
    <p>Booking Receipt</p>
  </div>

  <div class="section">
    <h2>Booking Information</h2>
    <div class="row">
      <span class="label">Booking ID:</span>
      <span class="value">${booking.id}</span>
    </div>
    <div class="row">
      <span class="label">Created:</span>
      <span class="value">${formatDateTime(booking.createdAt)}</span>
    </div>
    <div class="row">
      <span class="label">Payment Status:</span>
      <span class="value">${booking.paymentStatus}</span>
    </div>
  </div>

  <div class="section">
    <h2>Guest Information</h2>
    <div class="row">
      <span class="label">Name:</span>
      <span class="value">${guest.fullName}</span>
    </div>
    <div class="row">
      <span class="label">Email:</span>
      <span class="value">${guest.email}</span>
    </div>
    <div class="row">
      <span class="label">Phone:</span>
      <span class="value">${guest.phone}</span>
    </div>
    <div class="row">
      <span class="label">ID:</span>
      <span class="value">${guest.idType} - ${guest.idNumber}</span>
    </div>
  </div>

  <div class="section">
    <h2>Room Details</h2>
    <div class="row">
      <span class="label">Room Number:</span>
      <span class="value">${room.roomNumber}</span>
    </div>
    <div class="row">
      <span class="label">Room Type:</span>
      <span class="value">${roomType.name}</span>
    </div>
    <div class="row">
      <span class="label">Check-in:</span>
      <span class="value">${formatDate(booking.checkInDate)}</span>
    </div>
    <div class="row">
      <span class="label">Check-out:</span>
      <span class="value">${formatDate(booking.checkOutDate)}</span>
    </div>
    <div class="row">
      <span class="label">Nights:</span>
      <span class="value">${booking.nights}</span>
    </div>
  </div>

  <div class="total-section">
    <h2>Payment Summary</h2>
    <div class="total-row">
      <span>Rate per Night:</span>
      <span>${formatCurrency(booking.ratePerNight)}</span>
    </div>
    <div class="total-row">
      <span>Subtotal (${booking.nights} nights):</span>
      <span>${formatCurrency(booking.subtotal)}</span>
    </div>
    ${booking.discountAmount > 0 ? `
    <div class="total-row">
      <span>Discount ${booking.discount ? `(${booking.discount.type === 'percentage' ? booking.discount.value + '%' : formatCurrency(booking.discount.value)})` : ''}:</span>
      <span>-${formatCurrency(booking.discountAmount)}</span>
    </div>
    ` : ''}
    ${booking.surchargeAmount > 0 ? `
    <div class="total-row">
      <span>Surcharge ${booking.surcharge ? `(${booking.surcharge.type === 'percentage' ? booking.surcharge.value + '%' : formatCurrency(booking.surcharge.value)})` : ''}:</span>
      <span>+${formatCurrency(booking.surchargeAmount)}</span>
    </div>
    ` : ''}
    <div class="total-row grand-total">
      <span>Total Amount:</span>
      <span>${formatCurrency(booking.total)}</span>
    </div>
  </div>

  ${booking.notes ? `
  <div class="section">
    <h2>Notes</h2>
    <p>${booking.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for choosing ${settings.hotelName}</p>
    <p>Generated on ${formatDateTime(new Date().toISOString())}</p>
    ${footerHtml ? `<div class="custom-footer">${footerHtml}</div>` : ''}
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

export function printReceipt(
  booking: Booking,
  guest: Guest,
  room: Room,
  roomType: RoomType
) {
  const receiptHtml = generateReceipt(booking, guest, room, roomType);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  }
}

// Enhanced async booking invoice with financial summary
export async function generateInvoice(
  booking: Booking,
  guest: Guest,
  room: Room | null,
  roomType: RoomType | null,
  bookingRooms?: BookingRoom[]
): Promise<string> {
  const settings = getSettings();
  const footerHtml = settings.receiptFooter 
    ? settings.receiptFooter.split('\n').map(line => `<p>${line}</p>`).join('')
    : '';
  
  // Calculate financial totals using existing service
  const totalPaid = await getTotalPaidForBooking(booking.id);
  const outstandingBalance = booking.total - totalPaid;
  
  // Determine invoice status
  let invoiceStatus = 'UNPAID';
  let statusColor = '#ea580c'; // orange
  if (totalPaid >= booking.total) {
    invoiceStatus = 'PAID IN FULL';
    statusColor = '#16a34a'; // green
  } else if (totalPaid > 0) {
    invoiceStatus = 'PARTIALLY PAID';
    statusColor = '#3b82f6'; // blue
  }
  
  // If bookingRooms provided, render breakdown table
  const roomBreakdownHtml = bookingRooms && bookingRooms.length > 0 ? `
    <div class="section">
      <h2>Room Breakdown</h2>
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px; border-bottom:1px solid #eee">Room</th>
            <th style="text-align:left; padding:6px; border-bottom:1px solid #eee">Type</th>
            <th style="text-align:right; padding:6px; border-bottom:1px solid #eee">Rate/Night</th>
            <th style="text-align:right; padding:6px; border-bottom:1px solid #eee">Nights</th>
            <th style="text-align:right; padding:6px; border-bottom:1px solid #eee">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${bookingRooms.map(br => {
            const nights = Math.max(1, Math.floor((new Date(br.checkOutDate).getTime() - new Date(br.checkInDate).getTime()) / (24*60*60*1000)));
            const subtotal = (br.priceAtBooking || 0) * nights;
            return `
              <tr>
                <td style="padding:6px; border-bottom:1px solid #f0f0f0">${br.roomNumber}</td>
                <td style="padding:6px; border-bottom:1px solid #f0f0f0">${br.roomTypeName}</td>
                <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right">${formatCurrency(br.priceAtBooking)}</td>
                <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right">${nights}</td>
                <td style="padding:6px; border-bottom:1px solid #f0f0f0; text-align:right">${formatCurrency(subtotal)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Invoice - ${booking.id}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #333;
    }
    .header-subtitle {
      color: #666;
      font-size: 18px;
      margin-top: 5px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h2 {
      color: #555;
      border-bottom: 2px solid #eee;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #666;
    }
    .value {
      color: #333;
    }
    .financial-section {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    .financial-row:last-child {
      border-bottom: none;
    }
    .financial-label {
      font-weight: bold;
      color: #333;
    }
    .financial-value {
      font-weight: bold;
      color: #333;
    }
    .outstanding {
      color: #ea580c;
      background: #fff3e0;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .paid {
      color: #16a34a;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      margin-top: 10px;
      color: white;
    }
    .info-note {
      background: #e3f2fd;
      border-left: 4px solid #1976d2;
      padding: 10px;
      margin: 15px 0;
      font-size: 13px;
      color: #1565c0;
      border-radius: 2px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      color: #666;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    .custom-footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px dashed #ccc;
      white-space: pre-line;
    }
    .custom-footer p {
      margin: 3px 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;" />` : ''}
    <h1>${settings.hotelName}</h1>
    <div class="header-subtitle">BOOKING INVOICE</div>
    ${settings.address ? `<p style="margin: 5px 0; color: #666;">${settings.address}</p>` : ''}
    ${settings.phone || settings.email ? `<p style="margin: 5px 0; color: #666;">${[settings.phone, settings.email].filter(Boolean).join(' | ')}</p>` : ''}
  </div>

  <div class="section">
    <h2>Invoice Details</h2>
    <div class="row">
      <span class="label">Invoice Number:</span>
      <span class="value">${booking.id}</span>
    </div>
    <div class="row">
      <span class="label">Invoice Date:</span>
      <span class="value">${formatDateTime(new Date().toISOString())}</span>
    </div>
    <div class="row">
      <span class="label">Stay Period:</span>
      <span class="value">${formatDate(booking.checkInDate)} to ${formatDate(booking.checkOutDate)} (${booking.nights} night(s))</span>
    </div>
  </div>

  <div class="section">
    <h2>Guest Information</h2>
    <div class="row">
      <span class="label">Name:</span>
      <span class="value">${guest.fullName}</span>
    </div>
    <div class="row">
      <span class="label">Email:</span>
      <span class="value">${guest.email}</span>
    </div>
    <div class="row">
      <span class="label">Phone:</span>
      <span class="value">${guest.phone}</span>
    </div>
  </div>

  <div class="section">
    <h2>Room Details</h2>
    ${room && roomType ? `
      <div class="row">
        <span class="label">Room Number:</span>
        <span class="value">${room.roomNumber}</span>
      </div>
      <div class="row">
        <span class="label">Room Type:</span>
        <span class="value">${roomType.name}</span>
      </div>
    ` : ''}
  </div>

  ${roomBreakdownHtml}

  <div class="financial-section">
    <h2>Financial Summary</h2>
    <div class="financial-row">
      <span class="financial-label">Rate per Night:</span>
      <span class="financial-value">${formatCurrency(booking.ratePerNight)}</span>
    </div>
    <div class="financial-row">
      <span class="financial-label">Subtotal (${booking.nights} nights):</span>
      <span class="financial-value">${formatCurrency(booking.subtotal)}</span>
    </div>
    ${booking.discountAmount > 0 ? `
    <div class="financial-row">
      <span class="financial-label">Discount ${booking.discount ? `(${booking.discount.type === 'percentage' ? booking.discount.value + '%' : formatCurrency(booking.discount.value)})` : ''}:</span>
      <span class="financial-value" style="color: #16a34a;">-${formatCurrency(booking.discountAmount)}</span>
    </div>
    ` : ''}
    ${booking.surchargeAmount > 0 ? `
    <div class="financial-row">
      <span class="financial-label">Surcharge ${booking.surcharge ? `(${booking.surcharge.type === 'percentage' ? booking.surcharge.value + '%' : formatCurrency(booking.surcharge.value)})` : ''}:</span>
      <span class="financial-value" style="color: #ea580c;">+${formatCurrency(booking.surchargeAmount)}</span>
    </div>
    ` : ''}
    <div class="financial-row" style="border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; font-size: 18px;">
      <span class="financial-label">Total Charges:</span>
      <span class="financial-value">${formatCurrency(booking.total)}</span>
    </div>
    <div class="financial-row">
      <span class="financial-label">Total Paid:</span>
      <span class="financial-value paid">${formatCurrency(totalPaid)}</span>
    </div>
    <div class="financial-row" style="background: #fff3e0; padding: 8px; border-radius: 3px; margin-top: 5px;">
      <span class="financial-label" style="color: #e65100;">Outstanding Balance:</span>
      <span class="financial-value" style="color: #e65100;">${formatCurrency(outstandingBalance)}</span>
    </div>
  </div>

  <div style="text-align: center;">
    <div class="status-badge" style="background-color: ${statusColor};">${invoiceStatus}</div>
  </div>

  <div class="info-note">
    <strong>ℹ️ Note:</strong> This invoice summarizes booking charges for the stay. Individual payment receipts are issued per payment transaction. Please retain payment receipts for your records.
  </div>

  ${booking.notes ? `
  <div class="section">
    <h2>Special Requests / Notes</h2>
    <p>${booking.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for your stay at ${settings.hotelName}</p>
    ${footerHtml ? `<div class="custom-footer">${footerHtml}</div>` : ''}
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

export async function printInvoice(
  booking: Booking,
  guest: Guest,
  room: Room | null,
  roomType: RoomType | null,
  bookingRooms?: BookingRoom[]
) {
  const invoiceHtml = await generateInvoice(booking, guest, room, roomType, bookingRooms);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  }
}

// Enhanced payment receipt with financial snapshot
export function generatePaymentReceipt(
  payment: Payment,
  booking: Booking,
  guest: Guest,
  room: Room,
  methodName: string,
  totalPaid: number = 0
): string {
  const settings = getSettings();
  const balancePayable = booking.total - totalPaid;
  const balanceBeforePayment = totalPaid - payment.amount;
  const footerHtml = settings.receiptFooter 
    ? settings.receiptFooter.split('\n').map(line => `<p>${line}</p>`).join('')
    : '';
  
  // Determine payment type label
  let paymentTypeLabel = payment.paymentType.charAt(0).toUpperCase() + payment.paymentType.slice(1);
  if (payment.paymentType === 'partial') {
    paymentTypeLabel = 'Partial Payment';
  } else if (payment.paymentType === 'full') {
    paymentTypeLabel = 'Full Payment';
  } else if (payment.paymentType === 'deposit') {
    paymentTypeLabel = 'Deposit';
  }
  
  // If remaining balance is zero after this payment
  if (balancePayable <= 0 && payment.paymentType === 'partial') {
    paymentTypeLabel = 'Debt Settlement';
  }
  
  // Generate a human-readable receipt reference (using timestamp + first 6 chars of payment ID)
  const receiptRef = `RCP-${formatDate(payment.paymentDate).replace(/\//g, '')}-${payment.id.substring(0, 6).toUpperCase()}`;
    
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - ${payment.id}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #333;
    }
    .header-subtitle {
      color: #666;
      font-size: 18px;
      margin-top: 5px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h2 {
      color: #555;
      border-bottom: 2px solid #eee;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #666;
    }
    .value {
      color: #333;
    }
    .total-section {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    .total-row:last-child {
      border-bottom: none;
    }
    .total-row.highlight {
      background: #e3f2fd;
      padding: 8px;
      border-radius: 3px;
      margin-top: 5px;
      color: #1565c0;
      font-weight: bold;
    }
    .financial-snapshot {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
      border-left: 4px solid #3b82f6;
    }
    .snapshot-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 14px;
    }
    .settlement-complete {
      background: #dcfce7;
      border-left: 4px solid #16a34a;
      color: #166534;
    }
    .footer-note {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 15px 0;
      font-size: 13px;
      color: #92400e;
      border-radius: 2px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      color: #666;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    .custom-footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px dashed #ccc;
      white-space: pre-line;
    }
    .custom-footer p {
      margin: 3px 0;
    }
    .receipt-ref {
      background: #f0f0f0;
      padding: 8px;
      border-radius: 3px;
      font-weight: bold;
      text-align: center;
      margin: 15px 0;
      font-family: monospace;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${settings.logo ? `<img src="${settings.logo}" alt="Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;" />` : ''}
    <h1>${settings.hotelName}</h1>
    <div class="header-subtitle">PAYMENT RECEIPT</div>
    ${settings.address ? `<p style="margin: 5px 0; color: #666;">${settings.address}</p>` : ''}
    ${settings.phone || settings.email ? `<p style="margin: 5px 0; color: #666;">${[settings.phone, settings.email].filter(Boolean).join(' | ')}</p>` : ''}
  </div>

  <div class="receipt-ref">Receipt Reference: ${receiptRef}</div>

  <div class="section">
    <h2>Receipt Details</h2>
    <div class="row">
      <span class="label">Transaction ID:</span>
      <span class="value">${payment.id}</span>
    </div>
    <div class="row">
      <span class="label">Date & Time:</span>
      <span class="value">${formatDate(payment.paymentDate)} at ${payment.paymentTime}</span>
    </div>
    <div class="row">
      <span class="label">Receipt Issued:</span>
      <span class="value">${formatDateTime(new Date().toISOString())}</span>
    </div>
    <div class="row">
      <span class="label">Payment Type:</span>
      <span class="value" style="font-weight: bold; color: #3b82f6;">${paymentTypeLabel}</span>
    </div>
  </div>

  <div class="section">
    <h2>Booking & Guest Information</h2>
    <div class="row">
      <span class="label">Booking ID:</span>
      <span class="value">${booking.id}</span>
    </div>
    <div class="row">
      <span class="label">Guest Name:</span>
      <span class="value">${guest.fullName}</span>
    </div>
    <div class="row">
      <span class="label">Guest Email:</span>
      <span class="value">${guest.email}</span>
    </div>
    <div class="row">
      <span class="label">Guest Phone:</span>
      <span class="value">${guest.phone}</span>
    </div>
    <div class="row">
      <span class="label">Room Number:</span>
      <span class="value">${room.roomNumber}</span>
    </div>
    <div class="row">
      <span class="label">Stay Dates:</span>
      <span class="value">${formatDate(booking.checkInDate)} to ${formatDate(booking.checkOutDate)}</span>
    </div>
  </div>

  <div class="total-section">
    <h2>Financial Snapshot</h2>
    <div class="snapshot-row">
      <span><strong>Booking Total:</strong></span>
      <span style="font-weight: bold;">${formatCurrency(booking.total)}</span>
    </div>
    <div class="snapshot-row" style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
      <span>Balance Before This Payment:</span>
      <span>${formatCurrency(balanceBeforePayment)}</span>
    </div>
    <div class="snapshot-row">
      <span>Amount Paid (This Transaction):</span>
      <span style="color: #16a34a; font-weight: bold;">+${formatCurrency(payment.amount)}</span>
    </div>
    <div class="snapshot-row" style="background: ${balancePayable > 0 ? '#fff3e0' : '#dcfce7'}; padding: 8px; border-radius: 3px; margin-top: 5px;">
      <span style="font-weight: bold; color: ${balancePayable > 0 ? '#e65100' : '#166534'};">Balance After Payment:</span>
      <span style="font-weight: bold; color: ${balancePayable > 0 ? '#e65100' : '#166534'};">${formatCurrency(balancePayable)}</span>
    </div>
  </div>

  <div class="section">
    <h2>Payment Information</h2>
    <div class="row">
      <span class="label">Payment Method:</span>
      <span class="value">${methodName}</span>
    </div>
    ${payment.notes ? `
    <div class="row">
      <span class="label">Payment Notes:</span>
      <span class="value">${payment.notes}</span>
    </div>
    ` : ''}
  </div>

  ${balancePayable <= 0 ? `
  <div class="footer-note settlement-complete">
    <strong>✓ Settlement Complete:</strong> This payment has settled the outstanding balance for this booking. Thank you!
  </div>
  ` : `
  <div class="footer-note">
    <strong>⚠️ Outstanding Balance:</strong> A balance of ${formatCurrency(balancePayable)} remains payable for this booking.
  </div>
  `}

  <div class="footer">
    <p>Thank you for your payment to ${settings.hotelName}</p>
    <p style="font-size: 12px; color: #999; margin-top: 10px;">
      This receipt acknowledges payment received. Please retain this receipt for your records. Outstanding balances remain payable where applicable.
    </p>
    ${footerHtml ? `<div class="custom-footer">${footerHtml}</div>` : ''}
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

export function printPaymentReceipt(
  payment: Payment,
  booking: Booking,
  guest: Guest,
  room: Room,
  methodName: string,
  totalPaid: number = 0
) {
  const receiptHtml = generatePaymentReceipt(payment, booking, guest, room, methodName, totalPaid);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  }
}
