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
exports.deletePromo = exports.updatePromo = exports.createPromo = exports.listPromos = exports.resolveDispute = exports.getBookingDetail = exports.listAllBookings = void 0;
const bookingService = __importStar(require("../services/bookingService"));
const promoService = __importStar(require("../services/promoService"));
const bookingValidation_1 = require("../validation/bookingValidation");
const promoValidation_1 = require("../validation/promoValidation");
const listAllBookings = async (req, res, next) => {
    try {
        const query = bookingValidation_1.adminListBookingsQuerySchema.parse(req.query);
        const result = await bookingService.listAllBookings(query);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listAllBookings = listAllBookings;
const getBookingDetail = async (req, res, next) => {
    try {
        const booking = await bookingService.getBookingById(req.params.id);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.getBookingDetail = getBookingDetail;
const resolveDispute = async (req, res, next) => {
    try {
        const input = bookingValidation_1.resolveDisputeSchema.parse(req.body);
        const booking = await bookingService.resolveDispute(req.params.id, req.user.id, input);
        res.json({ success: true, data: booking });
    }
    catch (error) {
        next(error);
    }
};
exports.resolveDispute = resolveDispute;
const listPromos = async (req, res, next) => {
    try {
        const query = promoValidation_1.listPromosQuerySchema.parse(req.query);
        const result = await promoService.listPromos(query.page, query.limit);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listPromos = listPromos;
const createPromo = async (req, res, next) => {
    try {
        const input = promoValidation_1.createPromoSchema.parse(req.body);
        const promo = await promoService.createPromo(input);
        res.status(201).json({ success: true, data: promo });
    }
    catch (error) {
        next(error);
    }
};
exports.createPromo = createPromo;
const updatePromo = async (req, res, next) => {
    try {
        const input = promoValidation_1.updatePromoSchema.parse(req.body);
        const promo = await promoService.updatePromo(req.params.id, input);
        res.json({ success: true, data: promo });
    }
    catch (error) {
        next(error);
    }
};
exports.updatePromo = updatePromo;
const deletePromo = async (req, res, next) => {
    try {
        await promoService.deletePromo(req.params.id);
        res.json({ success: true, data: { message: "Promo code deleted" } });
    }
    catch (error) {
        next(error);
    }
};
exports.deletePromo = deletePromo;
//# sourceMappingURL=admin.controller.js.map