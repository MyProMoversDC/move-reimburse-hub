import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registers the current device with FCM and saves the token to `device_tokens`.
 * No-op on web — only runs inside the Capacitor native shell.
 */
export const usePushNotifications = (userId: string | null | undefined) => {
  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor?.isNativePlatform?.()) return;

        const { PushNotifications } = await import("@capacitor/push-notifications");

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") {
          console.warn("[push] permission not granted");
          return;
        }

        await PushNotifications.register();

        PushNotifications.addListener("registration", async (token) => {
          if (!mounted) return;
          const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
          await supabase
            .from("device_tokens")
            .upsert(
              { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
              { onConflict: "token" }
            );
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.error("[push] registration error", err);
        });
      } catch (e) {
        console.warn("[push] init skipped:", e);
      }
    })();

    return () => { mounted = false; };
  }, [userId]);
};
