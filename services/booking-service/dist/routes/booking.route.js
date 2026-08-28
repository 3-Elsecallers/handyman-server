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
const express_1 = require("express");
const bookingController = __importStar(require("../controllers/booking.controller"));
const authenticate_middleware_1 = require("../middlewares/authenticate.middleware");
const router = (0, express_1.Router)();
router.post("/", (0, authenticate_middleware_1.requireRole)("customer"), bookingController.createBooking);
router.get("/:id", bookingController.getBooking);
router.put("/:id/cancel", bookingController.cancelBooking);
router.post("/:id/dispute", (0, authenticate_middleware_1.requireRole)("customer"), bookingController.disputeBooking);
router.get("/:id/timeline", bookingController.getTimeline);
router.put("/:id/confirm", (0, authenticate_middleware_1.requireRole)("provider"), bookingController.confirmBooking);
router.put("/:id/decline", (0, authenticate_middleware_1.requireRole)("provider"), bookingController.declineBooking);
router.put("/:id/start", (0, authenticate_middleware_1.requireRole)("provider"), bookingController.startBooking);
router.put("/:id/complete", (0, authenticate_middleware_1.requireRole)("provider"), bookingController.completeBooking);
exports.default = router;
//# sourceMappingURL=booking.route.js.map