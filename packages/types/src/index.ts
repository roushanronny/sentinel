export type OrganizationRole = 'OWNER' | 'ADMIN' | 'ENGINEER' | 'VIEWER';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'DEGRADED';

export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityEventStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}
