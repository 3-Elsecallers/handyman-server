import { config } from "../../config/env";
import type {
  Notification,
  NotificationChannel,
} from "../../../generated/prisma";
import type { DeliveryProvider, DeliveryResult, DeliveryTarget } from "./types";

export class PushProvider implements DeliveryProvider {
  readonly channel: NotificationChannel = "push";

  async deliver(
    notification: Notification,
    target: DeliveryTarget,
  ): Promise<DeliveryResult> {
    const tokens = target.deviceTokens;
    if (tokens.length === 0) {
      return {
        channel: this.channel,
        ok: false,
        error: "No active device tokens",
      };
    }

    // Stub: real FCM/APNs delivery is not wired yet (see implementation plan
    // Phase 8). Log the push payload exactly as a real provider would receive it.
    const configured = Boolean(config.notification.providers.push.serviceAccountPath);
    if (!configured) {
      console.log(
        `[Delivery:push] [stub] would send push to ${tokens.length} token(s) for notification ${notification.id}`,
      );
    }

    return { channel: this.channel, ok: true };
  }
}