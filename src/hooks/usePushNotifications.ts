import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Registers the current device with FCM/APNs and saves the token to `device_tokens`.
 * No-op on web — only runs inside the Capacitor native shell (Android + iOS).
 *
 * Chat deep-linking:
 * - When a chat push is tapped, we stash {conversationId,messageId} in localStorage
 *   under `pendingChatDeepLink` and dispatch an `open-chat` CustomEvent. ChatInterface
 *   listens and selects/scrolls/highlights the target message.
 *
 * Foreground suppression:
 * - If the user is actively viewing the same conversation (window.__activeChatConversationId),
 *   we skip the in-app toast and clear that notification from the tray.
 *
 * Per-conversation clearing on open:
 * - `window.dispatchEvent(new CustomEvent('clear-chat-notifications', { detail:{ conversationId }}))`
 *   triggers removal of ONLY the delivered notifications whose data.reference_id matches
 *   that conversation. Other conversations are left intact.
 */
export const usePushNotifications = (userId: string | null | undefined) => {
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const listenerHandles: Array<{ remove: () => Promise<void> }> = [];
    let PushNotificationsRef: any = null;

    const clearForConversation = async (conversationId: string) => {
      try {
        if (!PushNotificationsRef) return;
        const delivered = await PushNotificationsRef.getDeliveredNotifications();
        const match = (delivered?.notifications ?? []).filter((n: any) => {
          const d = n?.data ?? {};
          return d.reference_type === "chat" && String(d.reference_id) === String(conversationId);
        });
        if (match.length > 0) {
          await PushNotificationsRef.removeDeliveredNotifications({ notifications: match });
        }
      } catch (e) {
        console.warn("[push] clearForConversation failed", e);
      }
    };

    const clearHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { conversationId?: string } | undefined;
      if (detail?.conversationId) void clearForConversation(detail.conversationId);
    };
    window.addEventListener("clear-chat-notifications", clearHandler);

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor?.isNativePlatform?.()) return;

        const { PushNotifications } = await import("@capacitor/push-notifications");
        PushNotificationsRef = PushNotifications;

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

        // Foreground delivery — iOS suppresses system banner; show toast unless user
        // is already viewing this conversation.
        const recvHandle = await PushNotifications.addListener(
          "pushNotificationReceived",
          async (notification) => {
            const data = (notification.data ?? {}) as Record<string, string>;
            const activeId = (window as any).__activeChatConversationId;
            const sameConversation =
              data.reference_type === "chat" &&
              activeId &&
              String(data.reference_id) === String(activeId);

            if (sameConversation) {
              // Already on this chat — drop the tray entry, no toast.
              await clearForConversation(String(data.reference_id));
              return;
            }
            const title = notification.title ?? "Notification";
            const body = notification.body ?? "";
            toast(title, { description: body });
          }
        );
        listenerHandles.push(recvHandle);

        const tapHandle = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const data = (action.notification.data ?? {}) as Record<string, string>;
            if (data.reference_type === "chat" && data.reference_id) {
              const detail = {
                conversationId: String(data.reference_id),
                messageId: data.message_id ? String(data.message_id) : null,
              };
              try {
                localStorage.setItem("pendingChatDeepLink", JSON.stringify(detail));
              } catch {}
              window.dispatchEvent(new CustomEvent("open-chat", { detail }));
              void clearForConversation(detail.conversationId);
            }
          }
        );
        listenerHandles.push(tapHandle);
      } catch (e) {
        console.warn("[push] init skipped:", e);
      }
    })();

    return () => {
      mounted = false;
      window.removeEventListener("clear-chat-notifications", clearHandler);
      listenerHandles.forEach((h) => h.remove().catch(() => {}));
    };
  }, [userId]);
};
