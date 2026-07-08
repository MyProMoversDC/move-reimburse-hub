import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, LogIn, LogOut, Clock } from "lucide-react";
import { formatDateTimeEST } from "@/lib/dateUtils";
import { differenceInMinutes } from "date-fns";
import { useT } from "@/lib/i18n";

interface Props {
  userId: string;
}

const SCANNER_ID = "mover-qr-scanner-region";

const MoverShiftClock = ({ userId }: Props) => {
  const { t } = useT();
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [scannerOpen, setScannerOpen] = useState<null | "in" | "out">(null);
  const [elapsed, setElapsed] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fetchData = async () => {
    const { data: open } = await supabase
      .from("shift_clock_entries")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveEntry(open);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: past } = await supabase
      .from("shift_clock_entries")
      .select("*")
      .eq("user_id", userId)
      .not("clock_out", "is", null)
      .gte("clock_in", since.toISOString())
      .order("clock_in", { ascending: false });
    setHistory(past || []);
  };

  useEffect(() => { fetchData(); }, [userId]);

  useEffect(() => {
    if (!activeEntry) { setElapsed(""); return; }
    const tick = () => {
      const m = differenceInMinutes(new Date(), new Date(activeEntry.clock_in));
      setElapsed(`${Math.floor(m / 60)}h ${m % 60}m`);
    };
    tick();
    const id = setInterval(tick, 1000 * 30);
    return () => clearInterval(id);
  }, [activeEntry]);

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch { /* ignore */ }
    scannerRef.current = null;
    setScannerOpen(null);
  };

  const handleScanned = async (text: string, expected: "in" | "out") => {
    await stopScanner();
    try {
      const url = new URL(text);
      const action = url.searchParams.get("action");
      const token = url.searchParams.get("token");
      if (!action || !token) {
        toast.error(t("mover.shiftClock.invalidQr"));
        return;
      }
      if (action !== expected) {
        toast.error(expected === "in" ? t("mover.shiftClock.wrongQrIn") : t("mover.shiftClock.wrongQrOut"));
        return;
      }
      const { data, error } = await supabase.rpc("redeem_mover_shift_qr" as any, { _action: action, _token: token });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        const map: Record<string, string> = {
          not_authenticated: t("mover.shiftClock.notAuthenticated"),
          not_a_mover: t("mover.shiftClock.notAMover"),
          invalid_token: t("mover.shiftClock.qrExpired"),
          already_clocked_in: t("mover.shiftClock.alreadyClockedIn"),
          not_clocked_in: t("mover.shiftClock.notClockedInError"),
        };
        toast.error(map[result?.error] || t("mover.shiftClock.couldNotProcess"));
      } else {
        toast.success(action === "in" ? t("mover.shiftClock.clockedInToast") : t("mover.shiftClock.clockedOutToast"));
        fetchData();
      }
    } catch (e: any) {
      toast.error(e.message || t("mover.shiftClock.invalidQr"));
    }
  };

  const openScanner = async (action: "in" | "out") => {
    setScannerOpen(action);
    setTimeout(async () => {
      try {
        const qr = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = qr;
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decoded) => handleScanned(decoded, action),
          () => { /* ignore frame errors */ }
        );
      } catch (e: any) {
        toast.error(e?.message || t("mover.shiftClock.cameraUnavailable"));
        setScannerOpen(null);
      }
    }, 100);
  };

  useEffect(() => () => { stopScanner(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> {t("mover.shiftClock.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/40">
            {activeEntry ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t("mover.shiftClock.onShift")}</Badge>
                  <p className="text-sm mt-1">{t("mover.shiftClock.clockedInAt").replace("{time}", formatDateTimeEST(activeEntry.clock_in))}</p>
                </div>
                <div className="text-2xl font-bold">{elapsed}</div>
              </div>
            ) : (
              <p className="text-muted-foreground">{t("mover.shiftClock.notClockedIn")}</p>
            )}
          </div>

          {scannerOpen ? (
            <div className="space-y-2">
              <div id={SCANNER_ID} className="w-full max-w-md mx-auto rounded-lg overflow-hidden border" />
              <Button variant="outline" className="w-full" onClick={stopScanner}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-20 text-base"
                onClick={() => openScanner("in")}
                disabled={!!activeEntry}
              >
                <LogIn className="h-5 w-5 mr-2" /> {t("mover.shiftClock.scanClockIn")}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-20 text-base"
                onClick={() => openScanner("out")}
                disabled={!activeEntry}
              >
                <LogOut className="h-5 w-5 mr-2" /> {t("mover.shiftClock.scanClockOut")}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <QrCode className="h-3 w-3" /> {t("mover.shiftClock.cameraHint")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("mover.shiftClock.last30Days")}</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("mover.shiftClock.noCompleted")}</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const mins = differenceInMinutes(new Date(h.clock_out), new Date(h.clock_in));
                return (
                  <div key={h.id} className="flex items-center justify-between border-b pb-2 text-sm">
                    <div>
                      <div>{formatDateTimeEST(h.clock_in)}</div>
                      <div className="text-xs text-muted-foreground">→ {formatDateTimeEST(h.clock_out)}</div>
                    </div>
                    <div className="font-medium">{Math.floor(mins / 60)}h {mins % 60}m</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MoverShiftClock;
