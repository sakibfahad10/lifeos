import { prisma } from '../config/prisma.js'

export type PermissionAction = 'view' | 'edit' | 'delete' | 'share'

export type PermissionScope = 'owner' | 'editor' | 'viewer' | 'none'

/**
 * Validates whether a user can perform an action on a user-owned resource.
 * Currently enforces strict single-user resource ownership, while structured
 * for multi-tenant and shared calendar / team permission expansion.
 */
export function verifyOwnership(userId: string, resourceOwnerId: string): boolean {
  if (!userId || !resourceOwnerId) return false
  return userId.trim().toLowerCase() === resourceOwnerId.trim().toLowerCase()
}

/**
 * Resolves the permission scope for a given calendar item.
 */
export async function getCalendarItemPermission(userId: string, itemId: string): Promise<PermissionScope> {
  if (!userId || !itemId) return 'none'
  const item = await prisma.calendarItem.findUnique({
    where: { id: itemId },
    select: { userId: true },
  })
  if (!item) return 'none'
  if (verifyOwnership(userId, item.userId)) return 'owner'
  return 'none'
}

/**
 * Checks if a user has access to perform an action on a calendar item.
 */
export async function canAccessCalendarItem(userId: string, itemId: string, action: PermissionAction = 'view'): Promise<boolean> {
  const scope = await getCalendarItemPermission(userId, itemId)
  if (scope === 'owner') return true
  if (scope === 'editor' && (action === 'view' || action === 'edit')) return true
  if (scope === 'viewer' && action === 'view') return true
  return false
}

/**
 * Checks if a user has access to an AI import draft.
 */
export async function canAccessDraft(userId: string, draftId: string): Promise<boolean> {
  if (!userId || !draftId) return false
  const draft = await prisma.aiImportDraft.findUnique({
    where: { id: draftId },
    select: { userId: true },
  })
  if (!draft) return false
  return verifyOwnership(userId, draft.userId)
}
