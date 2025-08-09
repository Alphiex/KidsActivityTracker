"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const childrenService_1 = require("../services/childrenService");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const validateChild = [
    (0, express_validator_1.body)('name').notEmpty().trim().withMessage('Name is required'),
    (0, express_validator_1.body)('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
    (0, express_validator_1.body)('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
    (0, express_validator_1.body)('interests').optional().isArray().withMessage('Interests must be an array'),
    (0, express_validator_1.body)('notes').optional().trim()
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};
router.post('/', auth_1.verifyToken, validateChild, handleValidationErrors, async (req, res) => {
    try {
        const child = await childrenService_1.childrenService.createChild({
            userId: req.user.id,
            name: req.body.name,
            dateOfBirth: new Date(req.body.dateOfBirth),
            gender: req.body.gender,
            avatarUrl: req.body.avatarUrl,
            interests: req.body.interests,
            notes: req.body.notes
        });
        res.status(201).json({
            success: true,
            child
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/', auth_1.verifyToken, async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const children = await childrenService_1.childrenService.getChildrenByUserId(req.user.id, includeInactive);
        res.json({
            success: true,
            children
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/stats', auth_1.verifyToken, async (req, res) => {
    try {
        const children = await childrenService_1.childrenService.getChildrenWithActivityStats(req.user.id);
        res.json({
            success: true,
            children
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/shared', auth_1.verifyToken, async (req, res) => {
    try {
        const sharedChildren = await childrenService_1.childrenService.getSharedChildren(req.user.id);
        res.json({
            success: true,
            children: sharedChildren
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/search', auth_1.verifyToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        const children = await childrenService_1.childrenService.searchChildren(req.user.id, q);
        res.json({
            success: true,
            children
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:childId', auth_1.verifyToken, async (req, res) => {
    try {
        const child = await childrenService_1.childrenService.getChildById(req.params.childId, req.user.id);
        if (!child) {
            return res.status(404).json({
                success: false,
                error: 'Child not found'
            });
        }
        res.json({
            success: true,
            child
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.put('/:childId', auth_1.verifyToken, async (req, res) => {
    try {
        const updateData = {};
        if (req.body.name !== undefined)
            updateData.name = req.body.name;
        if (req.body.dateOfBirth !== undefined)
            updateData.dateOfBirth = new Date(req.body.dateOfBirth);
        if (req.body.gender !== undefined)
            updateData.gender = req.body.gender;
        if (req.body.avatarUrl !== undefined)
            updateData.avatarUrl = req.body.avatarUrl;
        if (req.body.interests !== undefined)
            updateData.interests = req.body.interests;
        if (req.body.notes !== undefined)
            updateData.notes = req.body.notes;
        if (req.body.isActive !== undefined)
            updateData.isActive = req.body.isActive;
        const child = await childrenService_1.childrenService.updateChild(req.params.childId, req.user.id, updateData);
        if (!child) {
            return res.status(404).json({
                success: false,
                error: 'Child not found'
            });
        }
        res.json({
            success: true,
            child
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.patch('/:childId/interests', auth_1.verifyToken, async (req, res) => {
    try {
        const { interests } = req.body;
        if (!Array.isArray(interests)) {
            return res.status(400).json({
                success: false,
                error: 'Interests must be an array'
            });
        }
        const child = await childrenService_1.childrenService.updateChildInterests(req.params.childId, req.user.id, interests);
        if (!child) {
            return res.status(404).json({
                success: false,
                error: 'Child not found'
            });
        }
        res.json({
            success: true,
            child
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.delete('/:childId', auth_1.verifyToken, async (req, res) => {
    try {
        const permanent = req.query.permanent === 'true';
        let success;
        if (permanent) {
            success = await childrenService_1.childrenService.permanentlyDeleteChild(req.params.childId, req.user.id);
        }
        else {
            success = await childrenService_1.childrenService.deleteChild(req.params.childId, req.user.id);
        }
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Child not found'
            });
        }
        res.json({
            success: true,
            message: permanent ? 'Child permanently deleted' : 'Child deactivated'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/bulk', auth_1.verifyToken, async (req, res) => {
    try {
        const { children } = req.body;
        if (!Array.isArray(children) || children.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Children array is required'
            });
        }
        for (const child of children) {
            if (!child.name || !child.dateOfBirth) {
                return res.status(400).json({
                    success: false,
                    error: 'Each child must have name and dateOfBirth'
                });
            }
        }
        const createdChildren = await childrenService_1.childrenService.bulkCreateChildren(req.user.id, children.map(child => ({
            name: child.name,
            dateOfBirth: new Date(child.dateOfBirth),
            gender: child.gender,
            avatarUrl: child.avatarUrl,
            interests: child.interests || [],
            notes: child.notes
        })));
        res.status(201).json({
            success: true,
            children: createdChildren
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=children.js.map