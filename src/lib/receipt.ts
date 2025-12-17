import { Booking, Guest, Room, RoomType } from './db';
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
      color: #999;
      font-size: 14px;
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
