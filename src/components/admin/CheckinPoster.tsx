import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";

interface CheckinPosterProps {
  eventTitle: string;
  eventDate: string;
  eventId: string;
  checkinPin: string;
  onClose: () => void;
}

export default function CheckinPoster({
  eventTitle,
  eventDate,
  eventId,
  checkinPin,
  onClose,
}: CheckinPosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);

  const appDomain = window.location.origin;
  const checkinUrl = `${appDomain}/events/${eventId}?action=checkin&pin=${checkinPin}`;

  const handlePrint = () => {
    const content = posterRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Check-in Poster — ${eventTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
          .poster { width: 100%; max-width: 600px; padding: 48px 40px; text-align: center; }
          .title { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #1a3a2a; margin-bottom: 8px; }
          .date { font-family: 'Inter', sans-serif; font-size: 16px; color: #6b7280; margin-bottom: 40px; }
          .label { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
          .pin { font-family: 'Inter', sans-serif; font-size: 80px; font-weight: 700; color: #166534; letter-spacing: 16px; margin-bottom: 40px; }
          .divider { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
          .divider-line { flex: 1; height: 1px; background: #d1d5db; }
          .divider-text { font-family: 'Inter', sans-serif; font-size: 13px; color: #9ca3af; }
          .qr-label { font-family: 'Inter', sans-serif; font-size: 13px; color: #6b7280; margin-top: 16px; }
          .qr-container { display: inline-block; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; }
          .footer { margin-top: 40px; font-family: 'Inter', sans-serif; font-size: 12px; color: #9ca3af; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const formattedDate = eventDate
    ? format(new Date(eventDate), "EEEE, MMMM d, yyyy 'at' h:mm a")
    : "";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold text-foreground">Check-in Poster</h3>
          <div className="flex gap-1">
            <Button size="sm" variant="default" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-border bg-white p-6 overflow-hidden">
          <div ref={posterRef}>
            <div className="poster" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
              <div className="title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#1a3a2a", marginBottom: 6 }}>
                {eventTitle}
              </div>
              {formattedDate && (
                <div className="date" style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#6b7280", marginBottom: 32 }}>
                  {formattedDate}
                </div>
              )}
              <div className="label" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                Enter this PIN to check in
              </div>
              <div className="pin" style={{ fontFamily: "Inter, sans-serif", fontSize: 64, fontWeight: 700, color: "#166534", letterSpacing: 12, marginBottom: 32 }}>
                {checkinPin}
              </div>
              <div className="divider" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div className="divider-line" style={{ flex: 1, height: 1, background: "#d1d5db" }} />
                <div className="divider-text" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#9ca3af" }}>
                  or scan
                </div>
                <div className="divider-line" style={{ flex: 1, height: 1, background: "#d1d5db" }} />
              </div>
              <div className="qr-container" style={{ display: "inline-block", padding: 12, border: "2px solid #e5e7eb", borderRadius: 12 }}>
                <QRCodeSVG value={checkinUrl} size={180} level="M" />
              </div>
              <div className="qr-label" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#6b7280", marginTop: 12 }}>
                Scan with your phone camera to check in
              </div>
              <div className="footer" style={{ marginTop: 32, fontFamily: "Inter, sans-serif", fontSize: 10, color: "#9ca3af" }}>
                Zawya Community
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
