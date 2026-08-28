"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reassignBooking = exports.completeBooking = exports.startBooking = exports.declineBooking = exports.confirmBooking = exports.listProviderBookings = exports.listCustomerBookings = exports.getTimeline = exports.disputeBooking = exports.cancelBooking = exports.getBooking = exports.createBooking = void 0;
const bookingService = __importStar(require("../services/bookingService"));
const bookingValidation_1 = require("../validation/bookingValidation");
const createBooking = async (req, res, next) => {
    try {
        const isRequest = req.body?.type === "request";
        let booking;
        if (isRequest) {
            const input = bookingValidation_1.requestBookingSchema.parse(req.body);
            booking = await bookingService.createRequestBooking(req.user.id, input);
        }
        else {
            const input = bookingValidation_1.instantBookingSchema.parse(req.body);
            booking = await bookingService.createInstantBooking(req.user.id, input);
        }
        res.status(201).json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.createBooking = createBooking;
const getBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.getBookingDetail(req.params.id, req.user);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.getBooking = getBooking;
const cancelBooking = async (req, res, next) => {
    try {
        const input = bookingValidation_1.cancelBookingSchema.parse(req.body);
        const booking = await bookingService.cancelBooking(req.params.id, req.user, input.reason);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelBooking = cancelBooking;
const disputeBooking = async (req, res, next) => {
    try {
        const input = bookingValidation_1.disputeBookingSchema.parse(req.body);
        const booking = await bookingService.disputeBooking(req.params.id, req.user.id, input);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.disputeBooking = disputeBooking;
const getTimeline = async (req, res, next) => {
    try {
        const timeline = await bookingService.getTimeline(req.params.id, req.user);
        res.json({ success: true, data: timeline });
    }
    catch (error) {
        next(error);
    }
};
exports.getTimeline = getTimeline;
const listCustomerBookings = async (req, res, next) => {
    try {
        const query = bookingValidation_1.listBookingsQuerySchema.parse(req.query);
        const result = await bookingService.listCustomerBookings(req.user.id, query);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listCustomerBookings = listCustomerBookings;
const listProviderBookings = async (req, res, next) => {
    try {
        const query = bookingValidation_1.listBookingsQuerySchema.parse(req.query);
        const result = await bookingService.listProviderBookings(req.user.id, query);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listProviderBookings = listProviderBookings;
const confirmBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.confirmBooking(req.params.id, req.user.id);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.confirmBooking = confirmBooking;
const declineBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.declineBooking(req.params.id, req.user.id);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.declineBooking = declineBooking;
const startBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.startBooking(req.params.id, req.user.id);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.startBooking = startBooking;
const completeBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.completeBooking(req.params.id, req.user.id);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.completeBooking = completeBooking;
const reassignBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.reassignBooking(req.params.id, req.user.id);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.reassignBooking = reassignBooking;
//# sourceMappingURL=booking.controller.js.map