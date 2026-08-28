"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAllBookings = exports.listProviderBookingsByUserId = exports.listCustomerBookingsByUserId = exports.listProviderBookings = exports.listCustomerBookings = exports.getTimeline = exports.resolveDispute = exports.disputeBooking = exports.cancelBooking = exports.completeBooking = exports.startBooking = exports.reassignBooking = exports.declineBooking = exports.confirmBooking = exports.createRequestBooking = exports.createInstantBooking = exports.getBookingDetail = exports.getBookingById = void 0;
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const kafka_1 = require("../utils/kafka");
const serviceClient_1 = require("../utils/serviceClient");
const pricingService_1 = require("./pricingService");
const promoService_1 = require("./promoService");
const configMultiplier = (complexity) => {
    switch (complexity) {
        case "moderate": return 1.2;
        case "complex": return 1.5;
        default: return 1.0;
    }
};
const bookingSelect = {
    id: true,
    customerId: true,
    providerId: true,
    providerUserId: true,
    serviceId: true,
    type: true,
    status: true,
    scheduledAt: true,
    scheduledWindowEnd: true,
    completedAt: true,
    cancelledAt: true,
    cancelledBy: true,
    cancellationReason: true,
    refundAmount: true,
    locationLine1: true,
    locationLine2: true,
    locationCity: true,
    locationState: true,
    locationPostal: true,
    locationLat: true,
    locationLng: true,
    priceQuote: true,
    basePrice: true,
    complexity: true,
    complexityMultiplier: true,
    travelFee: true,
    surgeAmount: true,
    promoCodeId: true,
    promoDiscount: true,
    notes: true,
    description: true,
    durationMins: true,
    reassignCount: true,
    createdAt: true,
    updatedAt: true,
    promoCode: { select: { code: true } },
    invites: {
        select: {
            id: true,
            providerId: true,
            providerUserId: true,
            status: true,
            invitedAt: true,
            respondedAt: true,
            expiresAt: true,
        },
        orderBy: { invitedAt: "asc" },
    },
};
const recordTimeline = async (bookingId, status, actorId, actorRole, note) => {
    return prisma_1.prisma.bookingTimeline.create({
        data: { bookingId, status, actorId, actorRole, note },
    });
};
const getBookingById = async (bookingId) => {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        select: bookingSelect,
    });
    if (!booking)
        throw new errorHandler_middleware_1.AppError(404, "Booking not found");
    return booking;
};
exports.getBookingById = getBookingById;
const getBookingDetail = async (bookingId, actingUser) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, actingUser);
    return booking;
};
exports.getBookingDetail = getBookingDetail;
const assertAccess = (booking, actingUser) => {
    const hasDirectAccess = actingUser.role === "admin" ||
        actingUser.id === booking.customerId ||
        (booking.providerUserId != null && actingUser.id === booking.providerUserId);
    const hasInvite = booking.invites?.some((i) => i.providerUserId === actingUser.id && (i.status === "pending" || i.status === "accepted")) ?? false;
    if (!hasDirectAccess && !hasInvite) {
        throw new errorHandler_middleware_1.AppError(403, "You do not have access to this booking");
    }
};
const isAssignedProvider = (booking, userId) => booking.providerUserId != null && booking.providerUserId === userId;
const hasPendingInvite = (booking, userId) => booking.invites?.some((i) => i.providerUserId === userId && i.status === "pending") ?? false;
const createInstantBooking = async (customerId, input) => {
    await (0, serviceClient_1.fetchUser)(customerId);
    const service = await (0, serviceClient_1.fetchService)(input.serviceId);
    const provider = await (0, serviceClient_1.fetchProvider)(input.providerId);
    if (provider.status !== "active" || !provider.verified) {
        throw new errorHandler_middleware_1.AppError(400, "Provider is not available for booking");
    }
    const scheduledAt = new Date(input.scheduledAt);
    const availability = await (0, serviceClient_1.validateProviderAvailability)(input.providerId, scheduledAt.toISOString(), service.durationMins);
    if (!availability.available) {
        throw new errorHandler_middleware_1.AppError(409, `Slot unavailable: ${availability.conflicts.join(", ")}`);
    }
    let promo = null;
    if (input.promoCode) {
        const baseSubtotal = service.basePrice * configMultiplier(input.complexity);
        promo = await (0, promoService_1.validatePromoCode)(input.promoCode, customerId, baseSubtotal);
    }
    const price = (0, pricingService_1.computePrice)({
        basePrice: service.basePrice,
        complexity: input.complexity,
        scheduledAt,
        customerLat: input.locationLat,
        customerLng: input.locationLng,
        providerLat: provider.lat,
        providerLng: provider.lng,
        promoDiscount: promo?.discount ?? 0,
    });
    const booking = await prisma_1.prisma.booking.create({
        data: {
            customerId,
            providerId: input.providerId,
            providerUserId: provider.userId,
            serviceId: input.serviceId,
            type: "instant",
            status: "pending",
            scheduledAt,
            durationMins: service.durationMins,
            locationLine1: input.locationLine1,
            locationLine2: input.locationLine2,
            locationCity: input.locationCity,
            locationState: input.locationState,
            locationPostal: input.locationPostal,
            locationLat: input.locationLat,
            locationLng: input.locationLng,
            basePrice: price.basePrice,
            complexity: input.complexity,
            complexityMultiplier: price.complexityMultiplier,
            travelFee: price.travelFee,
            surgeAmount: price.surgeAmount,
            promoCodeId: promo?.promo.id,
            promoDiscount: price.promoDiscount,
            priceQuote: price.finalPrice,
            notes: input.notes,
        },
    });
    await recordTimeline(booking.id, "pending", customerId, "customer", "Booking created");
    if (promo) {
        await (0, promoService_1.claimPromoUsage)(promo.promo.id, customerId, booking.id);
    }
    await (0, kafka_1.publishEvent)("booking.created", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        serviceId: booking.serviceId,
        scheduledAt: booking.scheduledAt.toISOString(),
        priceQuote: booking.priceQuote,
    });
    return booking;
};
exports.createInstantBooking = createInstantBooking;
const REQUEST_INVITE_LIMIT = 5;
const REQUEST_INVITE_TTL_MS = 30 * 60 * 1000;
const createRequestBooking = async (customerId, input) => {
    await (0, serviceClient_1.fetchUser)(customerId);
    const service = await (0, serviceClient_1.fetchService)(input.serviceId);
    const scheduledStart = new Date(input.scheduledWindowStart);
    const scheduledEnd = new Date(input.scheduledWindowEnd);
    if (scheduledEnd <= scheduledStart) {
        throw new errorHandler_middleware_1.AppError(400, "Scheduled window end must be after start");
    }
    const matches = await (0, serviceClient_1.matchProviderCandidates)({
        serviceId: input.serviceId,
        lat: input.locationLat,
        lng: input.locationLng,
        scheduledAt: scheduledStart.toISOString(),
        durationMins: service.durationMins,
        limit: REQUEST_INVITE_LIMIT,
    });
    if (matches.length === 0) {
        throw new errorHandler_middleware_1.AppError(409, "No eligible providers found for the requested time");
    }
    const multiplier = configMultiplier(input.complexity);
    const basePrice = Math.round(service.basePrice * multiplier * 100) / 100;
    const booking = await prisma_1.prisma.booking.create({
        data: {
            customerId,
            providerId: null,
            providerUserId: null,
            serviceId: input.serviceId,
            type: "request",
            status: "pending",
            scheduledAt: scheduledStart,
            scheduledWindowEnd: scheduledEnd,
            durationMins: service.durationMins,
            locationLine1: input.locationLine1,
            locationLine2: input.locationLine2,
            locationCity: input.locationCity,
            locationState: input.locationState,
            locationPostal: input.locationPostal,
            locationLat: input.locationLat,
            locationLng: input.locationLng,
            basePrice,
            complexity: input.complexity,
            complexityMultiplier: multiplier,
            travelFee: 0,
            surgeAmount: 0,
            priceQuote: basePrice,
            description: input.description,
            invites: {
                create: matches.map((m) => ({
                    providerId: m.providerId,
                    providerUserId: m.userId,
                    expiresAt: new Date(Date.now() + REQUEST_INVITE_TTL_MS),
                })),
            },
        },
        select: bookingSelect,
    });
    await recordTimeline(booking.id, "pending", customerId, "customer", "Request-based booking created");
    await (0, kafka_1.publishEvent)("booking.created", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: null,
        serviceId: booking.serviceId,
        scheduledAt: booking.scheduledAt.toISOString(),
        priceQuote: booking.priceQuote,
    });
    return booking;
};
exports.createRequestBooking = createRequestBooking;
const confirmBooking = async (bookingId, providerUserId) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, { id: providerUserId, role: "provider" });
    if (booking.status !== "pending") {
        throw new errorHandler_middleware_1.AppError(409, `Cannot confirm a booking in status ${booking.status}`);
    }
    if (booking.type === "instant") {
        if (!isAssignedProvider(booking, providerUserId)) {
            throw new errorHandler_middleware_1.AppError(403, "Only the assigned provider can confirm");
        }
        const updated = await prisma_1.prisma.booking.update({
            where: { id: booking.id },
            data: { status: "confirmed" },
        });
        await recordTimeline(booking.id, "confirmed", providerUserId, "provider", "Provider accepted");
        await (0, kafka_1.publishEvent)("booking.confirmed", booking.id, {
            bookingId: booking.id,
            customerId: booking.customerId,
            providerId: booking.providerId,
            scheduledAt: booking.scheduledAt.toISOString(),
        });
        return updated;
    }
    const invite = booking.invites?.find((i) => i.providerUserId === providerUserId && i.status === "pending");
    if (!invite) {
        throw new errorHandler_middleware_1.AppError(403, "You do not have a pending invite for this booking");
    }
    const provider = await (0, serviceClient_1.fetchProvider)(invite.providerId);
    const price = (0, pricingService_1.computePrice)({
        basePrice: booking.basePrice / (booking.complexityMultiplier || 1),
        complexity: booking.complexity,
        scheduledAt: booking.scheduledAt,
        customerLat: booking.locationLat,
        customerLng: booking.locationLng,
        providerLat: provider.lat,
        providerLng: provider.lng,
        promoDiscount: booking.promoDiscount,
    });
    let updated;
    try {
        updated = await prisma_1.prisma.$transaction(async (tx) => {
            const claim = await tx.bookingInvite.updateMany({
                where: { id: invite.id, status: "pending" },
                data: { status: "accepted", respondedAt: new Date() },
            });
            if (claim.count === 0) {
                throw new errorHandler_middleware_1.AppError(409, "This booking was already accepted by another provider");
            }
            await tx.bookingInvite.updateMany({
                where: { bookingId: booking.id, status: "pending" },
                data: { status: "expired" },
            });
            return tx.booking.update({
                where: { id: booking.id },
                data: {
                    status: "confirmed",
                    providerId: provider.id,
                    providerUserId: provider.userId,
                    travelFee: price.travelFee,
                    surgeAmount: price.surgeAmount,
                    priceQuote: price.finalPrice,
                },
            });
        });
    }
    catch (error) {
        if (error instanceof errorHandler_middleware_1.AppError)
            throw error;
        throw new errorHandler_middleware_1.AppError(409, "Booking could not be confirmed");
    }
    await recordTimeline(booking.id, "confirmed", providerUserId, "provider", "Provider accepted");
    await (0, kafka_1.publishEvent)("booking.confirmed", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: provider.id,
        scheduledAt: booking.scheduledAt.toISOString(),
    });
    return updated;
};
exports.confirmBooking = confirmBooking;
const declineBooking = async (bookingId, providerUserId) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, { id: providerUserId, role: "provider" });
    if (booking.status !== "pending") {
        throw new errorHandler_middleware_1.AppError(409, `Cannot decline a booking in status ${booking.status}`);
    }
    if (booking.type === "instant") {
        if (!isAssignedProvider(booking, providerUserId)) {
            throw new errorHandler_middleware_1.AppError(403, "Only the assigned provider can decline");
        }
        const updated = await prisma_1.prisma.booking.update({
            where: { id: booking.id },
            data: { status: "cancelled", cancelledAt: new Date(), cancelledBy: providerUserId },
        });
        await recordTimeline(booking.id, "cancelled", providerUserId, "provider", "Provider declined");
        await (0, kafka_1.publishEvent)("booking.cancelled", booking.id, {
            bookingId: booking.id,
            cancelledBy: providerUserId,
            reason: "Provider declined",
            refundAmount: 0,
        });
        return updated;
    }
    const invite = booking.invites?.find((i) => i.providerUserId === providerUserId && i.status === "pending");
    if (!invite) {
        throw new errorHandler_middleware_1.AppError(403, "You do not have a pending invite for this booking");
    }
    const updated = await prisma_1.prisma.bookingInvite.update({
        where: { id: invite.id },
        data: { status: "declined", respondedAt: new Date() },
    });
    await recordTimeline(booking.id, "pending", providerUserId, "provider", "Provider declined the invite");
    return updated;
};
exports.declineBooking = declineBooking;
const MAX_REASSIGNMENTS = 3;
const reassignBooking = async (bookingId, customerId) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    if (booking.customerId !== customerId) {
        throw new errorHandler_middleware_1.AppError(403, "Only the booking customer can request a new provider");
    }
    if (booking.type !== "request") {
        throw new errorHandler_middleware_1.AppError(409, "Only request-based bookings can be reassigned");
    }
    const reassignable = ["pending", "confirmed"];
    if (!reassignable.includes(booking.status)) {
        throw new errorHandler_middleware_1.AppError(409, `Cannot reassign a booking in status ${booking.status}`);
    }
    if (booking.reassignCount >= MAX_REASSIGNMENTS) {
        throw new errorHandler_middleware_1.AppError(409, `Maximum of ${MAX_REASSIGNMENTS} reassignments reached`);
    }
    const declinedUserIds = booking.invites
        ?.filter((i) => i.status === "declined")
        .map((i) => i.providerUserId) ?? [];
    const excludedUserIds = new Set(booking.providerUserId != null ? [booking.providerUserId, ...declinedUserIds] : declinedUserIds);
    const matches = await (0, serviceClient_1.matchProviderCandidates)({
        serviceId: booking.serviceId,
        lat: booking.locationLat,
        lng: booking.locationLng,
        scheduledAt: booking.scheduledAt.toISOString(),
        durationMins: booking.durationMins ?? 60,
        limit: REQUEST_INVITE_LIMIT + excludedUserIds.size,
    });
    const newCandidates = matches.filter((m) => !excludedUserIds.has(m.userId)).slice(0, REQUEST_INVITE_LIMIT);
    if (newCandidates.length === 0) {
        throw new errorHandler_middleware_1.AppError(409, "No alternative providers found for reassignment");
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.bookingInvite.updateMany({
            where: { bookingId: booking.id, status: "pending" },
            data: { status: "expired" },
        });
        return tx.booking.update({
            where: { id: booking.id },
            data: {
                status: "pending",
                providerId: null,
                providerUserId: null,
                travelFee: 0,
                surgeAmount: 0,
                priceQuote: booking.basePrice,
                reassignCount: { increment: 1 },
                invites: {
                    create: newCandidates.map((m) => ({
                        providerId: m.providerId,
                        providerUserId: m.userId,
                        expiresAt: new Date(Date.now() + REQUEST_INVITE_TTL_MS),
                    })),
                },
            },
            select: bookingSelect,
        });
    });
    await recordTimeline(booking.id, "pending", customerId, "customer", "Customer requested a new provider");
    await (0, kafka_1.publishEvent)("booking.reassigned", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        serviceId: booking.serviceId,
        scheduledAt: booking.scheduledAt.toISOString(),
        priceQuote: booking.priceQuote,
    });
    return updated;
};
exports.reassignBooking = reassignBooking;
const startBooking = async (bookingId, providerId) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, { id: providerId, role: "provider" });
    if (booking.providerUserId !== providerId) {
        throw new errorHandler_middleware_1.AppError(403, "Only the booking provider can start");
    }
    if (booking.status !== "confirmed") {
        throw new errorHandler_middleware_1.AppError(409, `Cannot start a booking in status ${booking.status}`);
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "in_progress" },
    });
    await recordTimeline(booking.id, "in_progress", providerId, "provider", "Service started");
    await (0, kafka_1.publishEvent)("booking.started", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
    });
    return updated;
};
exports.startBooking = startBooking;
const completeBooking = async (bookingId, providerId) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, { id: providerId, role: "provider" });
    if (booking.providerUserId !== providerId) {
        throw new errorHandler_middleware_1.AppError(403, "Only the booking provider can complete");
    }
    if (booking.status !== "in_progress") {
        throw new errorHandler_middleware_1.AppError(409, `Cannot complete a booking in status ${booking.status}`);
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "completed", completedAt: new Date() },
    });
    await recordTimeline(booking.id, "completed", providerId, "provider", "Service completed");
    await (0, kafka_1.publishEvent)("booking.completed", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        serviceId: booking.serviceId,
        priceQuote: booking.priceQuote,
    });
    return updated;
};
exports.completeBooking = completeBooking;
const cancelBooking = async (bookingId, actingUser, reason) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, actingUser);
    const cancellable = ["pending", "confirmed"];
    if (!cancellable.includes(booking.status)) {
        throw new errorHandler_middleware_1.AppError(409, `Cannot cancel a booking in status ${booking.status}`);
    }
    const hoursUntil = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
    const isCustomer = actingUser.id === booking.customerId;
    let refundAmount = 0;
    if (isCustomer && hoursUntil >= 24) {
        refundAmount = booking.priceQuote;
    }
    else if (isCustomer && hoursUntil < 24) {
        refundAmount = Math.round(booking.priceQuote * 0.5 * 100) / 100;
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: actingUser.id,
            cancellationReason: reason,
            refundAmount,
        },
    });
    await recordTimeline(booking.id, "cancelled", actingUser.id, actingUser.role, reason || undefined);
    await (0, kafka_1.publishEvent)("booking.cancelled", booking.id, {
        bookingId: booking.id,
        cancelledBy: actingUser.id,
        reason: reason || undefined,
        refundAmount,
    });
    return updated;
};
exports.cancelBooking = cancelBooking;
const disputeBooking = async (bookingId, customerId, input) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, { id: customerId, role: "customer" });
    if (booking.customerId !== customerId) {
        throw new errorHandler_middleware_1.AppError(403, "Only the booking customer can open a dispute");
    }
    const disputable = ["confirmed", "in_progress", "completed"];
    if (!disputable.includes(booking.status)) {
        throw new errorHandler_middleware_1.AppError(409, `Cannot dispute a booking in status ${booking.status}`);
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "disputed" },
    });
    await recordTimeline(booking.id, "disputed", customerId, "customer", input.reason);
    await (0, kafka_1.publishEvent)("booking.disputed", booking.id, {
        bookingId: booking.id,
        customerId: booking.customerId,
        reason: input.reason,
    });
    return updated;
};
exports.disputeBooking = disputeBooking;
const resolveDispute = async (bookingId, adminId, input) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    if (booking.status !== "disputed") {
        throw new errorHandler_middleware_1.AppError(409, `Cannot resolve a booking in status ${booking.status}`);
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: {
            status: input.resolveTo,
            ...(input.resolveTo === "completed" ? { completedAt: new Date() } : {}),
        },
    });
    await recordTimeline(booking.id, input.resolveTo, adminId, "admin", input.note || "Dispute resolved");
    if (input.resolveTo === "completed") {
        await (0, kafka_1.publishEvent)("booking.completed", booking.id, {
            bookingId: booking.id,
            customerId: booking.customerId,
            providerId: booking.providerId,
            serviceId: booking.serviceId,
            priceQuote: booking.priceQuote,
        });
    }
    return updated;
};
exports.resolveDispute = resolveDispute;
const getTimeline = async (bookingId, actingUser) => {
    const booking = await (0, exports.getBookingById)(bookingId);
    assertAccess(booking, actingUser);
    return prisma_1.prisma.bookingTimeline.findMany({
        where: { bookingId },
        orderBy: { createdAt: "asc" },
    });
};
exports.getTimeline = getTimeline;
const listCustomerBookings = async (customerId, query) => {
    const where = { customerId };
    if (query.status)
        where.status = query.status;
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where,
            select: bookingSelect,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma_1.prisma.booking.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
};
exports.listCustomerBookings = listCustomerBookings;
const listProviderBookings = async (providerUserId, query) => {
    const where = {
        OR: [
            { providerUserId },
            { invites: { some: { providerUserId, status: "pending" } } },
        ],
    };
    if (query.status)
        where.status = query.status;
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where,
            select: bookingSelect,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma_1.prisma.booking.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
};
exports.listProviderBookings = listProviderBookings;
const listCustomerBookingsByUserId = async (customerId) => {
    return prisma_1.prisma.booking.findMany({
        where: { customerId },
        select: bookingSelect,
        orderBy: { createdAt: "desc" },
    });
};
exports.listCustomerBookingsByUserId = listCustomerBookingsByUserId;
const listProviderBookingsByUserId = async (providerId) => {
    return prisma_1.prisma.booking.findMany({
        where: { providerId },
        select: bookingSelect,
        orderBy: { createdAt: "desc" },
    });
};
exports.listProviderBookingsByUserId = listProviderBookingsByUserId;
const listAllBookings = async (query) => {
    const where = {};
    if (query.status)
        where.status = query.status;
    if (query.customerId)
        where.customerId = query.customerId;
    if (query.providerId)
        where.providerId = query.providerId;
    if (query.search) {
        where.OR = [
            { locationCity: { contains: query.search, mode: "insensitive" } },
            { locationState: { contains: query.search, mode: "insensitive" } },
            { locationPostal: { contains: query.search } },
        ];
    }
    const [items, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where,
            select: bookingSelect,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma_1.prisma.booking.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
};
exports.listAllBookings = listAllBookings;
//# sourceMappingURL=bookingService.js.map