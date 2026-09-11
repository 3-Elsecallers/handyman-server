import { config } from "../../config/env";
import type {
  Notification,
  NotificationChannel,
} from "../../../generated/prisma";
import type { DeliveryProvider, DeliveryResult, DeliveryTarget } from "./types";

export class EmailProvider implements DeliveryProvider {
  readonly channel: NotificationChannel = "email";

  async deliver(
    notification: Notification,
    target: DeliveryTarget,
  ): Promise<DeliveryResult> {
    const to = target.user?.email;
    if (!to) {
      return {
        channel: this.channel,
        ok: false,
        error: "No email on user profile",
      };
    }

    // Stub: real SMTP/SES delivery is not wired yet (see implementation plan
    // Phase 8). Log the rendered email the way a provider would send it.
    const configured = Boolean(config.notification.providers.email.host);
    if (!configured) {
      console.log(
        `[Delivery:email] [stub] would email "${notification.title}" to ${to} for notification ${notification.id}`,
      );
    }

    return { channel: this.channel, ok: true };
  }
}