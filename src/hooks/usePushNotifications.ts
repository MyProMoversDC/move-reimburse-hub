import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Registers the current device with FCM/APNs and saves the token to `device_tokens`.
 * No-op on web — only runs inside the Capacitor native shell (Android + iOS).
 *
 * iOS specifics:
 * - APNs requires explicit user permission; we prompt once on first registration.
 * - iOS hides system banners while the app is foregrounded, so we surface an in-app
 *   toast via `pushNotificationReceived`.
 * - `pushNotificationActionPerformed` exposes `data.reference_type` for future
 *   deep-link routing (e.g. tap a reimbursement push -> open that reimbursement).
 */
export const usePushNotifications = (userId: string | null | undefined) => {
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const listenerHandles: Array<{ remove: () => Promise<void> }> = [];

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

        const regHandle = await PushNotifications.addListener("registration", async (token) => {
          if (!mounted) return;
          const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
          await supabase
            .from("device_tokens")
            .upsert(
              { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
              { onConflict: "token" }
            );
        });
        listenerHandles.push(regHandle);

        const errHandle = await PushNotifications.addListener("registrationError", (err) => {
          console.error("[push] registration error", err);
        });
        listenerHandles.push(errHandle);

        // Foreground delivery — iOS suppresses system banner; show toast.
        const recvHandle = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            const title = notification.title ?? "Notification";
            const body = notification.body ?? "";
            toast(title, { description: body });
          }
        );
        listenerHandles.push(recvHandle);

        // Tap handler — placeholder for future deep linking.
        const tapHandle = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const data = action.notification.data ?? {};
            console.log("[push] tapped", data);
            // Future: route by data.reference_type / data.reference_id
          }
        );
        listenerHandles.push(tapHandle);
      } catch (e) {
        console.warn("[push] init skipped:", e);
      }
    })();

    return () => {
      mounted = false;
      listenerHandles.forEach((h) => h.remove().catch(() => {}));
    };
  }, [userId]);
};
