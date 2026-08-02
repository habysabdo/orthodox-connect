import { useEffect, useState } from "react";

/**
 * NotificationPrompt
 *
 * A banner that asks the user to enable browser notifications.
 *
 * Persistence rules:
 *  - When the user clicks "Enable"  → we store `oc_notifications_dismissed = "true"`.
 *  - When the user clicks "X" (close) → we store `oc_notifications_dismissed = "true"`.
 *
 * On mount we check BOTH:
 *   1. localStorage.getItem("oc_notifications_dismissed")
 *   2. Notification.permission
 *
 * The banner is NOT rendered when:
 *   - `oc_notifications_dismissed` === "true", OR
 *   - Notification.permission is "granted" (already allowed), OR
 *   - Notification.permission is "denied"  (user already declined in the browser).
 */

const DISMISS_KEY = "oc_notifications_dismissed";

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only run in the browser (SSR-safe guard).
    if (typeof window === "undefined") return;

    const dismissed = localStorage.getItem(DISMISS_KEY) === "true";

    // Notification API may be unavailable (older browsers / insecure context).
    let permission: NotificationPermission | undefined;
    if (typeof Notification !== "undefined") {
      permission = Notification.permission;
    }

    const alreadyHandled =
      dismissed ||
      permission === "granted" ||
      permission === "denied";

    setVisible(!alreadyHandled);
  }, []);

  /** Persist the dismissal so the banner never reappears. */
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      /* storage might be blocked — ignore */
    }
    setVisible(false);
  };

  /** "Enable" handler — request permission, then persist preference. */
  const handleEnable = async () => {
    if (typeof Notification === "undefined") {
      // No Notification API — just dismiss.
      dismiss();
      return;
    }

    try {
      const result = await Notification.requestPermission();
      // Whatever the outcome, remember the user's choice so we never re-prompt.
      dismiss();
      // Optional: you could fire a confirmation notification here when
      // result === "granted".
    } catch {
      // Some browsers throw if permission is already denied — dismiss anyway.
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-4 bg-blue-600 px-4 py-3 text-white shadow-lg">
      <div className="flex-1">
        <p className="text-sm font-medium">
          🔔 Stay in the loop — enable notifications to get updates on new posts
          and replies.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={handleEnable}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          Enable
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification prompt"
          className="text-white/80 transition hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default NotificationPrompt;
