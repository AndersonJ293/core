import { prisma } from "~/db.server";
import { logger } from "./logger.service";

export interface AuditLogParams {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: any;
  request: Request;
  status?: 'success' | 'failure';
}

export class AuditService {
  static async log(params: AuditLogParams) {
    try {
      const { userId, action, resource, resourceId, metadata, request, status = 'success' } = params;

      const auditLog = await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          metadata: metadata ? JSON.stringify(metadata) : null,
          ipAddress: getClientIP(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          status,
        },
      });

      logger.info(`Audit log created: ${action}`, {
        auditLogId: auditLog.id,
        userId,
        resource,
        resourceId,
      });

      return auditLog;
    } catch (error) {
      // Log error but don't fail the original operation
      logger.error("Failed to create audit log:", error);
    }
  }

  static async logTeamMemberInvite(params: {
    userId: string;
    teamId: string;
    invitedEmail: string;
    role: string;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'team.member.invite',
      resource: 'team',
      resourceId: params.teamId,
      metadata: {
        invitedEmail: params.invitedEmail,
        role: params.role,
      },
      request: params.request,
    });
  }

  static async logTeamMemberRemove(params: {
    userId: string;
    teamId: string;
    removedUserId: string;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'team.member.remove',
      resource: 'team',
      resourceId: params.teamId,
      metadata: {
        removedUserId: params.removedUserId,
      },
      request: params.request,
    });
  }

  static async logSpaceCreate(params: {
    userId: string;
    spaceId: string;
    teamId?: string;
    visibility: string;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'space.create',
      resource: 'space',
      resourceId: params.spaceId,
      metadata: {
        teamId: params.teamId,
        visibility: params.visibility,
      },
      request: params.request,
    });
  }

  static async logSpaceUpdate(params: {
    userId: string;
    spaceId: string;
    changes: any;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'space.update',
      resource: 'space',
      resourceId: params.spaceId,
      metadata: {
        changes: params.changes,
      },
      request: params.request,
    });
  }

  static async logSpaceDelete(params: {
    userId: string;
    spaceId: string;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'space.delete',
      resource: 'space',
      resourceId: params.spaceId,
      request: params.request,
    });
  }

  static async logTeamCreate(params: {
    userId: string;
    teamId: string;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'team.create',
      resource: 'team',
      resourceId: params.teamId,
      request: params.request,
    });
  }

  static async logTeamUpdate(params: {
    userId: string;
    teamId: string;
    changes: any;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'team.update',
      resource: 'team',
      resourceId: params.teamId,
      metadata: {
        changes: params.changes,
      },
      request: params.request,
    });
  }

  static async logPermissionDenied(params: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    reason: string;
    request: Request;
  }) {
    return this.log({
      userId: params.userId,
      action: 'permission.denied',
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: {
        attemptedAction: params.action,
        reason: params.reason,
      },
      request: params.request,
      status: 'failure',
    });
  }
}

function getClientIP(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }

  const xri = request.headers.get("x-real-ip");
  if (xri) {
    return xri;
  }

  return "unknown";
}
