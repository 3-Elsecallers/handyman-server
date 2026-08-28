"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = void 0;
const notFound = (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
};
exports.notFound = notFound;
//# sourceMappingURL=notFound.middleware.js.map