"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOwnership = verifyOwnership;
exports.getCalendarItemPermission = getCalendarItemPermission;
exports.canAccessCalendarItem = canAccessCalendarItem;
exports.canAccessDraft = canAccessDraft;
const prisma_js_1 = require("../config/prisma.js");
/**
 * Validates whether a user can perform an action on a user-owned resource.
 * Currently enforces strict single-user resource ownership, while structured
 * for multi-tenant and shared calendar / team permission expansion.
 */
function verifyOwnership(userId, resourceOwnerId) {
    if (!userId || !resourceOwnerId)
        return false;
    return userId.trim().toLowerCase() === resourceOwnerId.trim().toLowerCase();
}
/**
 * Resolves the permission scope for a given calendar item.
 */
async function getCalendarItemPermission(userId, itemId) {
    if (!userId || !itemId)
        return 'none';
    const item = await prisma_js_1.prisma.calendarItem.findUnique({
        where: { id: itemId },
        select: { userId: true },
    });
    if (!item)
        return 'none';
    if (verifyOwnership(userId, item.userId))
        return 'owner';
    return 'none';
}
/**
 * Checks if a user has access to perform an action on a calendar item.
 */
async function canAccessCalendarItem(userId, itemId, action = 'view') {
    const scope = await getCalendarItemPermission(userId, itemId);
    if (scope === 'owner')
        return true;
    if (scope === 'editor' && (action === 'view' || action === 'edit'))
        return true;
    if (scope === 'viewer' && action === 'view')
        return true;
    return false;
}
/**
 * Checks if a user has access to an AI import draft.
 */
async function canAccessDraft(userId, draftId) {
    if (!userId || !draftId)
        return false;
    const draft = await prisma_js_1.prisma.aiImportDraft.findUnique({
        where: { id: draftId },
        select: { userId: true },
    });
    if (!draft)
        return false;
    return verifyOwnership(userId, draft.userId);
}
