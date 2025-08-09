"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadChildData = exports.verifyMultipleChildOwnership = exports.verifyChildOwnership = void 0;
const childrenService_1 = require("../services/childrenService");
const verifyChildOwnership = async (req, res, next) => {
    try {
        const childId = req.params.childId;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        if (!childId) {
            return res.status(400).json({
                success: false,
                error: 'Child ID is required'
            });
        }
        const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
        if (!isOwner) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to access this child profile'
            });
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error verifying child ownership'
        });
    }
};
exports.verifyChildOwnership = verifyChildOwnership;
const verifyMultipleChildOwnership = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        let childIds = [];
        if (req.query.childIds) {
            childIds = req.query.childIds.split(',');
        }
        else if (req.body.childIds && Array.isArray(req.body.childIds)) {
            childIds = req.body.childIds;
        }
        else if (req.body.childId) {
            childIds = [req.body.childId];
        }
        if (childIds.length === 0) {
            return next();
        }
        for (const childId of childIds) {
            const isOwner = await childrenService_1.childrenService.verifyChildOwnership(childId, userId);
            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    error: `You do not have permission to access child profile: ${childId}`
                });
            }
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error verifying child ownership'
        });
    }
};
exports.verifyMultipleChildOwnership = verifyMultipleChildOwnership;
const loadChildData = async (req, res, next) => {
    try {
        const childId = req.params.childId;
        const userId = req.user?.id;
        if (!userId || !childId) {
            return next();
        }
        const child = await childrenService_1.childrenService.getChildById(childId, userId);
        if (!child) {
            return res.status(404).json({
                success: false,
                error: 'Child not found'
            });
        }
        req.child = child;
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error loading child data'
        });
    }
};
exports.loadChildData = loadChildData;
//# sourceMappingURL=childAuth.js.map