"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startKafkaConsumers = void 0;
const prisma_1 = require("../db/prisma");
const kafka_1 = require("../utils/kafka");
const serviceClient_1 = require("../utils/serviceClient");
const startKafkaConsumers = async () => {
    // Confirm payment received for a booking
    await (0, kafka_1.createConsumer)("payment.captured", async (value) => {
        const event = value;
        if (!event.bookingId)
            return;
        console.log(`[Kafka] Payment captured for booking ${event.bookingId}`);
    });
    // Update booking with refund status
    await (0, kafka_1.createConsumer)("payment.refunded", async (value) => {
        const event = value;
        if (!event.bookingId)
            return;
        await prisma_1.prisma.booking.updateMany({
            where: { id: event.bookingId },
            data: {
                ...(event.refundAmount != null ? { refundAmount: event.refundAmount } : {}),
            },
        });
        console.log(`[Kafka] Refund recorded for booking ${event.bookingId}`);
    });
    // Revalidate pending bookings when a provider's availability changes
    await (0, kafka_1.createConsumer)("provider.availability.changed", async (value) => {
        const event = value;
        if (!event.providerId)
            return;
        const pending = await prisma_1.prisma.booking.findMany({
            where: { providerId: event.providerId, status: "pending" },
        });
        for (const booking of pending) {
            const durationMins = booking.durationMins ?? 60;
            const { available } = await (0, serviceClient_1.validateProviderAvailability)(event.providerId, booking.scheduledAt.toISOString(), durationMins);
            if (!available && Date.now() < booking.scheduledAt.getTime()) {
                await prisma_1.prisma.booking.update({
                    where: { id: booking.id },
                    data: {
                        status: "cancelled",
                        cancelledAt: new Date(),
                        cancelledBy: "system",
                        cancellationReason: "Provider no longer available for scheduled time",
                    },
                });
                await prisma_1.prisma.bookingTimeline.create({
                    data: {
                        bookingId: booking.id,
                        status: "cancelled",
                        actorId: "system",
                        actorRole: "system",
                        note: "Cancelled due to provider availability change",
                    },
                });
                await (0, kafka_1.publishEvent)("booking.cancelled", booking.id, {
                    bookingId: booking.id,
                    cancelledBy: "system",
                    reason: "Provider no longer available",
                    refundAmount: 0,
                });
            }
        }
    });
    // Handle suspended users - cancel their active bookings
    await (0, kafka_1.createConsumer)("identity.user.suspended", async (value) => {
        const event = value;
        if (!event.userId)
            return;
        const active = await prisma_1.prisma.booking.findMany({
            where: {
                OR: [{ customerId: event.userId }],
                status: { in: ["pending", "confirmed"] },
            },
        });
        for (const booking of active) {
            await prisma_1.prisma.booking.update({
                where: { id: booking.id },
                data: {
                    status: "cancelled",
                    cancelledAt: new Date(),
                    cancelledBy: "system",
                    cancellationReason: "Account suspended",
                },
            });
            await prisma_1.prisma.bookingTimeline.create({
                data: {
                    bookingId: booking.id,
                    status: "cancelled",
                    actorId: "system",
                    actorRole: "system",
                    note: "Cancelled due to account suspension",
                },
            });
            await (0, kafka_1.publishEvent)("booking.cancelled", booking.id, {
                bookingId: booking.id,
                cancelledBy: "system",
                reason: "Account suspended",
                refundAmount: 0,
            });
        }
    });
    console.log("[Kafka] Booking service consumers started");
};
exports.startKafkaConsumers = startKafkaConsumers;
//# sourceMappingURL=kafkaConsumer.js.map