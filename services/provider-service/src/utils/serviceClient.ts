import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";

export interface InternalBooking {
  id: string;
  customerId: string;
  providerId: string | null;
  providerUserId: string | null;
  status: string;
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
