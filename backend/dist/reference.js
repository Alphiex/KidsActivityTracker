"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var prisma_1 = require("../../generated/prisma");
var router = (0, express_1.Router)();
var prisma = new prisma_1.PrismaClient();
/**
 * @route   GET /api/v1/categories
 * @desc    Get all activity categories with counts
 * @access  Public
 */
router.get('/categories', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var categories, categoriesWithCounts, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.activity.groupBy({
                        by: ['category'],
                        where: {
                            isActive: true,
                            category: {
                                not: null
                            }
                        },
                        _count: {
                            _all: true
                        },
                        orderBy: {
                            _count: {
                                _all: 'desc'
                            }
                        }
                    })];
            case 1:
                categories = _a.sent();
                categoriesWithCounts = categories.map(function (cat) { return ({
                    name: cat.category,
                    count: cat._count._all
                }); });
                res.json({
                    success: true,
                    categories: categoriesWithCounts
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Categories error:', error_1);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch categories'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @route   GET /api/v1/locations
 * @desc    Get all locations with active activities
 * @access  Public
 */
router.get('/locations', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var locations, cleanedLocations, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.location.findMany({
                        where: {
                            activities: {
                                some: {
                                    isActive: true
                                }
                            },
                            // We'll filter bad locations in JavaScript to avoid TypeScript issues
                        },
                        include: {
                            _count: {
                                select: {
                                    activities: {
                                        where: { isActive: true }
                                    }
                                }
                            }
                        },
                        orderBy: { name: 'asc' }
                    })];
            case 1:
                locations = _a.sent();
                cleanedLocations = locations.filter(function (loc) {
                    var name = loc.name;
                    // Check if name is too long (likely a description)
                    if (name.length > 100)
                        return false;
                    // Check if name contains newlines or special formatting
                    if (name.includes('\n') || name.includes('\r'))
                        return false;
                    // Check if name contains activity keywords
                    if (name.match(/lesson|class|program|registration|#\d{6}/i))
                        return false;
                    return true;
                });
                res.json({
                    success: true,
                    locations: cleanedLocations.map(function (loc) { return ({
                        id: loc.id,
                        name: loc.name.trim(),
                        address: loc.address,
                        city: loc.city,
                        province: loc.province,
                        postalCode: loc.postalCode,
                        facility: loc.facility,
                        activityCount: loc._count.activities
                    }); })
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('Locations error:', error_2);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch locations'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @route   GET /api/v1/providers
 * @desc    Get all active providers
 * @access  Public
 */
router.get('/providers', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var providers, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.provider.findMany({
                        where: { isActive: true },
                        select: {
                            id: true,
                            name: true,
                            website: true,
                            createdAt: true,
                            updatedAt: true
                        },
                        orderBy: { name: 'asc' }
                    })];
            case 1:
                providers = _a.sent();
                res.json({
                    success: true,
                    providers: providers
                });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                console.error('Providers error:', error_3);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch providers'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @route   GET /api/v1/age-groups
 * @desc    Get age groups with activity counts
 * @access  Public
 */
router.get('/age-groups', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var ageGroups, groupsWithCounts, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                ageGroups = [
                    { id: '0-2', name: '0-2 years', min: 0, max: 2 },
                    { id: '3-5', name: '3-5 years', min: 3, max: 5 },
                    { id: '6-8', name: '6-8 years', min: 6, max: 8 },
                    { id: '9-12', name: '9-12 years', min: 9, max: 12 },
                    { id: '13+', name: '13+ years', min: 13, max: 99 }
                ];
                return [4 /*yield*/, Promise.all(ageGroups.map(function (group) { return __awaiter(void 0, void 0, void 0, function () {
                        var count;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, prisma.activity.count({
                                        where: {
                                            isActive: true,
                                            ageMin: { lte: group.max },
                                            ageMax: { gte: group.min }
                                        }
                                    })];
                                case 1:
                                    count = _a.sent();
                                    return [2 /*return*/, __assign(__assign({}, group), { count: count })];
                            }
                        });
                    }); }))];
            case 1:
                groupsWithCounts = _a.sent();
                res.json({
                    success: true,
                    ageGroups: groupsWithCounts
                });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                console.error('Age groups error:', error_4);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch age groups'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @route   GET /api/v1/activity-types
 * @desc    Get activity types (subcategories) with counts
 * @access  Public
 */
router.get('/activity-types', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var activityTypes, typesWithCounts, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.activity.groupBy({
                        by: ['subcategory'],
                        where: {
                            isActive: true,
                            subcategory: {
                                not: null
                            }
                        },
                        _count: {
                            _all: true
                        },
                        orderBy: {
                            _count: {
                                _all: 'desc'
                            }
                        }
                    })];
            case 1:
                activityTypes = _a.sent();
                typesWithCounts = activityTypes.map(function (type) { return ({
                    name: type.subcategory,
                    count: type._count._all
                }); });
                res.json({
                    success: true,
                    activityTypes: typesWithCounts
                });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                console.error('Activity types error:', error_5);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch activity types'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
