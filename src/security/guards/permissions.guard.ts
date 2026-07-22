import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_admin: ['platform:*'],
  tenant_owner: ['*'],
  store_manager: [
    'products:create', 'products:read', 'products:update', 'products:delete',
    'categories:create', 'categories:read', 'categories:update', 'categories:delete',
    'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
    'orders:create', 'orders:read', 'orders:update', 'orders:delete',
    'customers:read', 'cms:read', 'analytics:read'
  ],
  warehouse_manager: [
    'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
    'warehouses:create', 'warehouses:read', 'warehouses:update', 'warehouses:delete',
    'shipments:create', 'shipments:read', 'shipments:update', 'shipments:delete',
    'products:read', 'orders:read'
  ],
  customer_support: [
    'orders:read', 'orders:update',
    'payments:read', 'payments:refund',
    'products:read', 'customers:read'
  ],
  marketing_manager: [
    'cms:create', 'cms:read', 'cms:update', 'cms:delete',
    'blog:create', 'blog:read', 'blog:update', 'blog:delete',
    'coupons:create', 'coupons:read', 'coupons:update', 'coupons:delete',
    'analytics:read'
  ],
  finance_manager: [
    'analytics:read',
    'payments:read',
    'orders:read'
  ],
  customer: [
    'storefront:read', 'storefront:checkout',
    'my-orders:read', 'my-orders:create'
  ]
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request['user'];

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: Missing user role mapping');
    }

    // Platform-wide operations use the superuser Prisma client and therefore
    // must never inherit the tenant_owner wildcard.
    if (requiredPermissions.some((permission) => permission.startsWith('platform:')) && user.role !== 'platform_admin') {
      throw new ForbiddenException('Access denied: Platform administrator role required');
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    
    const hasPermission = userPermissions.includes('*') || 
      requiredPermissions.every(requiredPerm => {
        if (userPermissions.includes(requiredPerm)) {
          return true;
        }
        
        const [resource] = requiredPerm.split(':');
        return userPermissions.includes(`${resource}:*`);
      });

    if (!hasPermission) {
      throw new ForbiddenException('Access denied: Insufficient permissions');
    }

    return true;
  }
}
