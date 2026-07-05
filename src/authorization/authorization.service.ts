import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ResolvedPermission {
  resource: string;
  action: string;
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async authorize(
    userId: string,
    organizationId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    const parsedRequired = requiredPermissions.map(this.parsePermission);
    const userPermissions = await this.getUserPermissions(userId, organizationId);

    return parsedRequired.every((required) =>
      userPermissions.some((userPerm) => this.matches(userPerm, required)),
    );
  }

  async getUserPermissions(userId: string, organizationId: string): Promise<ResolvedPermission[]> {
    const userWithRoles = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: {
        userRoles: {
          where: {
            role: { deletedAt: null },
          },
          select: {
            role: {
              select: {
                isOwner: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        resource: true,
                        action: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) {
      return [];
    }

    const permissionSet = new Set<string>();
    const result: ResolvedPermission[] = [];

    for (const ur of userWithRoles.userRoles) {
      if (ur.role.isOwner) {
        return [{ resource: '*', action: '*' }];
      }

      for (const rp of ur.role.rolePermissions) {
        const key = `${rp.permission.resource}:${rp.permission.action}`;
        if (!permissionSet.has(key)) {
          permissionSet.add(key);
          result.push({
            resource: rp.permission.resource,
            action: rp.permission.action,
          });
        }
      }
    }

    return result;
  }

  private parsePermission(permission: string): { resource: string; action: string } {
    const colonIndex = permission.lastIndexOf(':');
    if (colonIndex === -1) {
      return { resource: permission, action: '*' };
    }
    return {
      resource: permission.substring(0, colonIndex),
      action: permission.substring(colonIndex + 1),
    };
  }

  private matches(
    userPerm: ResolvedPermission,
    required: { resource: string; action: string },
  ): boolean {
    if (userPerm.resource === '*' && userPerm.action === '*') {
      return true;
    }

    if (userPerm.resource === required.resource && userPerm.action === '*') {
      return true;
    }

    if (userPerm.resource === required.resource && userPerm.action === required.action) {
      return true;
    }

    return false;
  }
}
