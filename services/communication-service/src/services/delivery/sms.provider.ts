import { config } from "../../config/env";
import type {
  Notification,
  NotificationChannel,
} from "../../../generated/prisma";
import type { DeliveryProvider, DeliveryResult, DeliveryTarget } from "./types";

export class SmsProvider implements DeliveryProvider {
  readonly channel: NotificationChannel = "sms";

  async deliver(
    notification: Notification,
    target: DeliveryTarget,
  ): Promise<DeliveryResult> {
    const to = target.user?.phone;
    if (!to) {
      return {
        channel: this.channel,
        ok: false,
        error: "No phone on user profile",
      };
    }

    // Stub: real SMS gateway (e.g. Africa's Talking) is not wired yet (see
    // implementation plan Phase 8). Log the SMS the way a gateway would send it.
    const configured = Boolean(config.notification.providers.sms.apiKey);
    if (!configured) {
      console.log(
        `[Delivery:sms] [stub] would SMS "${notification.title}" to ${to} for notification ${notification.id}`,
      );
    }

    return { channel: this.channel, ok: true };
  }
}