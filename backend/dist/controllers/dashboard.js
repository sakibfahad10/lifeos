"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = getDashboardSummary;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../config/prisma.js");
const auth_js_1 = require("../middleware/auth.js");
const api_response_js_1 = require("../utils/api-response.js");
async function getDashboardSummary(req, res, next) {
    try {
        const userId = (0, auth_js_1.getAuthUserId)(req);
        if (!userId) {
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        }
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        // Parallel queries for fast aggregation
        const [todayItems, upcomingItems, overdueItems, totalTasksCount, completedTasksCount, unreadNotificationsCount, activeRemindersCount, recurringCount, recentDrafts, recentNotifications, recentUpdatedItems,] = await Promise.all([
            // 1. Today's schedule items
            prisma_js_1.prisma.calendarItem.findMany({
                where: {
                    userId,
                    startAt: { gte: todayStart, lte: todayEnd },
                },
                include: { recurrenceRule: true, reminders: true },
                orderBy: { startAt: 'asc' },
                take: 30,
            }),
            // 2. Upcoming pending items (starting after now)
            prisma_js_1.prisma.calendarItem.findMany({
                where: {
                    userId,
                    status: client_1.CalendarItemStatus.PENDING,
                    startAt: { gt: now },
                },
                include: { recurrenceRule: true, reminders: true },
                orderBy: { startAt: 'asc' },
                take: 10,
            }),
            // 3. Overdue pending items
            prisma_js_1.prisma.calendarItem.findMany({
                where: {
                    userId,
                    status: client_1.CalendarItemStatus.PENDING,
                    startAt: { lt: now },
                },
                include: { recurrenceRule: true, reminders: true },
                orderBy: { startAt: 'desc' },
                take: 10,
            }),
            // 4. Tasks count
            prisma_js_1.prisma.calendarItem.count({
                where: { userId, type: client_1.CalendarItemType.TASK },
            }),
            // 5. Completed tasks count
            prisma_js_1.prisma.calendarItem.count({
                where: { userId, type: client_1.CalendarItemType.TASK, status: client_1.CalendarItemStatus.COMPLETED },
            }),
            // 6. Unread notifications
            prisma_js_1.prisma.notification.count({
                where: { userId, readAt: null },
            }),
            // 7. Active reminders
            prisma_js_1.prisma.reminder.count({
                where: { userId, enabled: true },
            }),
            // 8. Recurring schedules
            prisma_js_1.prisma.recurrenceRule.count({
                where: { calendarItem: { userId } },
            }),
            // 9. Recent AI import drafts
            prisma_js_1.prisma.aiImportDraft.findMany({
                where: { userId },
                include: { _count: { select: { items: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
            // 10. Recent notifications for activity feed
            prisma_js_1.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
            // 11. Recent item updates/creations
            prisma_js_1.prisma.calendarItem.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                take: 8,
            }),
        ]);
        const activityFeed = [];
        for (const item of recentUpdatedItems) {
            if (item.status === client_1.CalendarItemStatus.COMPLETED) {
                activityFeed.push({
                    id: `comp-${item.id}`,
                    type: 'ITEM_COMPLETED',
                    title: `Completed: ${item.title}`,
                    description: item.category || item.type,
                    timestamp: item.updatedAt.toISOString(),
                });
            }
            else {
                activityFeed.push({
                    id: `item-${item.id}`,
                    type: 'ITEM_UPDATED',
                    title: item.title,
                    description: `Scheduled for ${item.startAt.toLocaleDateString()}`,
                    timestamp: item.updatedAt.toISOString(),
                });
            }
        }
        for (const draft of recentDrafts) {
            activityFeed.push({
                id: `draft-${draft.id}`,
                type: draft.status === 'CONFIRMED' ? 'DRAFT_CONFIRMED' : 'DRAFT_CREATED',
                title: draft.originalFileName ? `AI Import: ${draft.originalFileName}` : 'AI Schedule Import Draft',
                description: `Status: ${draft.status} (${draft._count.items} items)`,
                timestamp: draft.createdAt.toISOString(),
            });
        }
        for (const notif of recentNotifications) {
            activityFeed.push({
                id: `notif-${notif.id}`,
                type: 'NOTIFICATION',
                title: notif.title,
                description: notif.message,
                timestamp: notif.createdAt.toISOString(),
            });
        }
        // Sort combined activity feed chronologically
        activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const recentActivity = activityFeed.slice(0, 10);
        const completedToday = todayItems.filter(i => i.status === client_1.CalendarItemStatus.COMPLETED).length;
        const summary = {
            metrics: {
                totalToday: todayItems.length,
                completedToday,
                upcomingCount: upcomingItems.length,
                overdueCount: overdueItems.length,
                totalTasks: totalTasksCount,
                completedTasks: completedTasksCount,
                unreadNotifications: unreadNotificationsCount,
                activeReminders: activeRemindersCount,
                recurringCount,
                recentAiDraftsCount: recentDrafts.length,
            },
            todayItems,
            upcomingItems,
            overdueItems,
            recentActivity,
            recentAiDrafts: recentDrafts.map(d => ({
                id: d.id,
                status: d.status,
                originalFileName: d.originalFileName,
                sourceType: d.sourceType,
                itemCount: d._count.items,
                createdAt: d.createdAt.toISOString(),
            })),
        };
        return (0, api_response_js_1.sendData)(res, summary);
    }
    catch (error) {
        return next(error);
    }
}
