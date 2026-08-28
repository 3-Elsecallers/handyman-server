"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.hashPassword = void 0;
const argon2_1 = __importDefault(require("argon2"));
const hashPassword = (password) => argon2_1.default.hash(password, { type: argon2_1.default.argon2id });
exports.hashPassword = hashPassword;
const verifyPassword = (hash, password) => argon2_1.default.verify(hash, password);
exports.verifyPassword = verifyPassword;
//# sourceMappingURL=password.js.map