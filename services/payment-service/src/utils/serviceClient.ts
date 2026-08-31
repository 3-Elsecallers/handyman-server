import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";

export interface InternalBooking {
  id: string;
  customerId: string;
  providerId: string | null;
  providerUserId: string | null;
  serviceId: string;
  type: string;
  status: string;
  scheduledAt: string;
  completedAt: string | null;
  priceQuote: number;
  basePrice: number;
  refundAmount: number;
  durationMins: number | null;
  createdAt: string;
}

export interface InternalUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role: string;
}

const headers = {
  "content-type": "application/json",
  "x-service-token": config.internalServiceToken,
};

export const fetchBooking = async (bookingId: string): Promise<InternalBooking> => {
  const res = await fetch(`${config.bookingServiceUrl}/internal/bookings/${bookingId}`, {
    headers,
  });
  if (!res.ok) {
    throw new AppError(502, "Booking service unavailable");
  }
  const { data } = (await res.json()) as { data: InternalBooking };
  return data;
};

export const fetchUser = async (userId: string): Promise<InternalUser | null> => {
  try {
    const res = await fetch(`${config.identityServiceUrl}/internal/users/${userId}`, {
      headers,
    });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: InternalUser };
    return data;
  } catch {
    return null;
  }
};
