import type { OrganizationRole } from '@sentinel/types';

export type Permission =
  | 'org:read'
  | 'org:manage'
  | 'members:read'
  | 'members:manage'
  | 'services:read'
  | 'services:write'
  | 'routes:read'
  | 'routes:write'
  | 'api_keys:read'
  | 'api_keys:write'
  | 'security_events:read'
  | 'incidents:read'
  | 'incidents:write'
  | 'audit:read'
  | 'settings:manage';

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: [
    'org:read',
    'org:manage',
    'members:read',
    'members:manage',
    'services:read',
    'services:write',
    'routes:read',
    'routes:write',
    'api_keys:read',
    'api_keys:write',
    'security_events:read',
    'incidents:read',
    'incidents:write',
    'audit:read',
    'settings:manage',
  ],
  ADMIN: [
    'org:read',
    'members:read',
    'members:manage',
    'services:read',
    'services:write',
    'routes:read',
    'routes:write',
    'api_keys:read',
    'api_keys:write',
    'security_events:read',
    'incidents:read',
    'incidents:write',
    'audit:read',
    'settings:manage',
  ],
  ENGINEER: [
    'org:read',
    'members:read',
    'services:read',
    'services:write',
    'routes:read',
    'routes:write',
    'api_keys:read',
    'security_events:read',
    'incidents:read',
    'incidents:write',
    'audit:read',
  ],
  VIEWER: [
    'org:read',
    'members:read',
    'services:read',
    'routes:read',
    'security_events:read',
    'incidents:read',
    'audit:read',
  ],
};

export function permissionsForRole(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: OrganizationRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(
      'FORBIDDEN',
      `Role ${role} does not have permission ${permission}`,
    );
  }
}

export class AuthorizationError extends Error {
  constructor(
    readonly code: 'FORBIDDEN' | 'TENANT_MISMATCH' | 'UNAUTHORIZED',
    message: string,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function assertSameTenant(actorOrgId: string, resourceOrgId: string): void {
  if (actorOrgId !== resourceOrgId) {
    throw new AuthorizationError(
      'TENANT_MISMATCH',
      'Resource does not belong to the active organization',
    );
  }
}
