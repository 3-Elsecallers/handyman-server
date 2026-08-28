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
exports.deleteAddress = exports.updateAddress = exports.createAddress = exports.listAddresses = exports.listLocations = void 0;
const addressService = __importStar(require("../services/addressService"));
const ghanaLocations_1 = require("../data/ghanaLocations");
const addressValidation_1 = require("../validation/addressValidation");
const listLocations = async (_req, res, next) => {
    try {
        res.json({ success: true, data: ghanaLocations_1.GHANA_REGIONS });
    }
    catch (error) {
        next(error);
    }
};
exports.listLocations = listLocations;
const listAddresses = async (req, res, next) => {
    try {
        const addresses = await addressService.listAddresses(req.user.id);
        res.json({ success: true, data: addresses });
    }
    catch (error) {
        next(error);
    }
};
exports.listAddresses = listAddresses;
const createAddress = async (req, res, next) => {
    try {
        const input = addressValidation_1.createAddressSchema.parse(req.body);
        const address = await addressService.createAddress(req.user.id, input);
        res.status(201).json({ success: true, data: address });
    }
    catch (error) {
        next(error);
    }
};
exports.createAddress = createAddress;
const updateAddress = async (req, res, next) => {
    try {
        const input = addressValidation_1.updateAddressSchema.parse(req.body);
        const address = await addressService.updateAddress(req.user.id, req.params.id, input);
        res.json({ success: true, data: address });
    }
    catch (error) {
        next(error);
    }
};
exports.updateAddress = updateAddress;
const deleteAddress = async (req, res, next) => {
    try {
        await addressService.deleteAddress(req.user.id, req.params.id);
        res.json({ success: true, data: { message: "Address deleted" } });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAddress = deleteAddress;
//# sourceMappingURL=address.controller.js.map