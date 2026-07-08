import { useEffect } from "react";
import {
  DEEP_LINK_EVENT,
  consumePendingDeepLink,
  resolveDeepLinkTab,
  type DeepLinkPayload,
} from "@/lib/notificationRouter";

/**
 * Wire a dashboard into the notification deep-link router.
 *
 * - Cold start: drains any pending payload from localStorage (survives an app
 *   launch triggered by tapping a notification while the app was terminated).
 * - Runtime: listens for `app-deep-link` events fired by the push tap handler
 *   when the app is already running (background resume / foreground).
 *
 * Chat receives an additional `open-chat` event so `ChatContainer` can
 * auto-select the target conversation and `ChatInterface` can scroll to the
 * mentioned message.
 */
export const useDeepLink = (
  role: string | null | undefined,
  setActiveTab: (id: string) => void,
) => {
  useEffect(() => {
    if (!role) return;

    const handle = (payload: DeepLinkPayload | null) => {
      if (!payload) return;
      const tab = resolveDeepLinkTab(role, payload.referenceType);
      if (tab) setActiveTab(tab);

      if (payload.referenceType === "chat" && payload.referenceId) {
        const detail = {
          conversationId: String(payload.referenceId),
          messageId: payload.messageId ? String(payload.messageId) : null,
        };
        try {
          localStorage.setItem("pendingChatDeepLink", JSON.stringify(detail));
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent("open-chat", { detail }));
        } catch {}
      }
    };

    // Cold start replay — a notification tap that launched the app writes to
    // localStorage before React mounts.
    handle(consumePendingDeepLink());

    const onEvent = (e: Event) => {
      handle(((e as CustomEvent).detail ?? null) as DeepLinkPayload | null);
    };
    window.addEventListener(DEEP_LINK_EVENT, onEvent);
    return () => window.removeEventListener(DEEP_LINK_EVENT, onEvent);
  }, [role, setActiveTab]);
};
