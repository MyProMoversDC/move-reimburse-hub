import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, QrCode } from "lucide-react";

const AnonymousFeedbackQRCode = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const target = `${window.location.origin}/anonymous-feedback`;
    setUrl(target);
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, target, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#000000", light: "#FFFFFF" },
      }).catch((err) => console.error("QR generation failed:", err));
    }
  }, []);

  const handleDownload = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "anonymous-feedback-qr.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("QR download failed:", err);
    }
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <canvas ref={canvasRef} className="border rounded-md bg-white p-2" />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Anonymous Feedback QR Code</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Print or share this QR code. Scanning it opens the Anonymous Feedback form (login or signup required first).
            </p>
            <p className="text-xs text-muted-foreground break-all">{url}</p>
            <Button onClick={handleDownload} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download QR Code (PNG)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnonymousFeedbackQRCode;
