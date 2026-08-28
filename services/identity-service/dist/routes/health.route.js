"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/", (_req, res) => {
    res.json({
        success: true,
        data: {
            service: "identity-service",
            status: "ok",
            timestamp: new Date().toISOString(),
        },
    });
});
exports.default = router;
//# sourceMappingURL=health.route.js.map