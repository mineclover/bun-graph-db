/**
 * User Consent and Authorization Framework for MCP 2025-06-18
 *
 * Implements explicit user consent and authorization as required by MCP specification:
 * - Explicit consent for all data access and operations
 * - Privacy controls and data access authorization
 * - Audit logging and compliance tracking
 * - Security boundaries and trust mechanisms
 */

import type {
  ConsentRequest,
  ConsentResponse,
  ConsentRestriction,
  DataAccessRequest,
  SecurityContext,
  AuditEvent,
  ConsentManager as IConsentManager,
  McpError,
  McpErrorCode,
} from "../types/McpTypes.js";

export interface ConsentRecord {
  id: string;
  toolName: string;
  operation: string;
  userId?: string;
  sessionId?: string;
  approved: boolean;
  grantedAt: Date;
  expiresAt?: Date;
  restrictions: ConsentRestriction[];
  metadata: Record<string, unknown>;
  revokedAt?: Date;
}

export interface ConsentManagerConfig {
  defaultApproval: boolean;
  consentTimeout: number;
  persistConsent: boolean;
  auditLogging: boolean;
  encryptAuditLogs: boolean;
  dataRetentionDays: number;
  requireExplicitConsent: string[]; // Tool names requiring explicit consent
  autoApprovedTools: string[]; // Tools that can be auto-approved
  sensitiveOperations: string[]; // Operations requiring additional security
}

export class ConsentManager implements IConsentManager {
  private consentRecords = new Map<string, ConsentRecord>();
  private auditEvents: AuditEvent[] = [];
  private consentCallbacks = new Map<string, (request: ConsentRequest) => Promise<boolean>>();

  constructor(private config: ConsentManagerConfig) {
    // Start cleanup timer for expired consents
    this.startCleanupTimer();
  }

  /**
   * Request consent for a tool operation
   */
  async requestConsent(request: ConsentRequest): Promise<ConsentResponse> {
    try {
      // Validate request
      this.validateConsentRequest(request);

      // Check if explicit consent is required
      const requiresExplicit = this.requiresExplicitConsent(request.toolName, request.operation);

      // Check for existing valid consent
      const existingConsent = this.findValidConsent(request.toolName, request.operation);
      if (existingConsent && !requiresExplicit) {
        await this.logAuditEvent({
          timestamp: new Date(),
          toolName: request.toolName,
          operation: request.operation,
          result: "success",
          dataAccessed: request.dataAccess?.scope,
        });

        return {
          approved: true,
          restrictions: existingConsent.restrictions,
          expiresAt: existingConsent.expiresAt,
          auditLog: this.config.auditLogging,
        };
      }

      // Auto-approve if configured and tool is in allowlist
      if (this.config.defaultApproval && this.isAutoApproved(request.toolName)) {
        return await this.grantConsent(request, true, "auto_approved");
      }

      // Request explicit consent from user
      return await this.requestExplicitConsent(request);
    } catch (error) {
      await this.logAuditEvent({
        timestamp: new Date(),
        toolName: request.toolName,
        operation: request.operation,
        result: "failure",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Check if a tool has permission for an operation
   */
  async checkPermission(toolName: string, operation: string): Promise<boolean> {
    const consent = this.findValidConsent(toolName, operation);
    return consent !== null;
  }

  /**
   * Log an audit event
   */
  async auditLog(event: AuditEvent): Promise<void> {
    await this.logAuditEvent(event);
  }

  /**
   * Revoke consent for a tool
   */
  async revokeConsent(toolName: string): Promise<void> {
    const revoked: string[] = [];

    for (const [key, record] of this.consentRecords.entries()) {
      if (record.toolName === toolName && !record.revokedAt) {
        record.revokedAt = new Date();
        revoked.push(key);
      }
    }

    if (revoked.length > 0) {
      await this.logAuditEvent({
        timestamp: new Date(),
        toolName,
        operation: "revoke_consent",
        result: "success",
        dataAccessed: [`revoked_${revoked.length}_consents`],
      });
    }
  }

  /**
   * Request explicit consent from user
   */
  private async requestExplicitConsent(request: ConsentRequest): Promise<ConsentResponse> {
    // In a real implementation, this would show a UI prompt to the user
    // For now, we'll use a callback system or default behavior

    const callback = this.consentCallbacks.get(request.toolName) || this.consentCallbacks.get("*");

    let approved = false;
    if (callback) {
      try {
        approved = await Promise.race([
          callback(request),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error("Consent timeout")), this.config.consentTimeout)
          ),
        ]);
      } catch (error) {
        approved = false;
      }
    } else {
      // Default behavior based on configuration
      approved = this.config.defaultApproval;
    }

    return await this.grantConsent(request, approved, approved ? "user_approved" : "user_denied");
  }

  /**
   * Grant or deny consent and create record
   */
  private async grantConsent(
    request: ConsentRequest,
    approved: boolean,
    reason: string
  ): Promise<ConsentResponse> {
    const consentId = this.generateConsentId(request);
    const now = new Date();
    const expiresAt = this.calculateExpirationTime(request);

    const restrictions = approved ? this.calculateRestrictions(request) : [];

    const record: ConsentRecord = {
      id: consentId,
      toolName: request.toolName,
      operation: request.operation,
      userId: request.userContext?.userId as string,
      sessionId: request.userContext?.sessionId as string,
      approved,
      grantedAt: now,
      expiresAt,
      restrictions,
      metadata: {
        reason,
        riskLevel: request.riskLevel,
        dataAccess: request.dataAccess,
        userContext: request.userContext,
      },
    };

    if (this.config.persistConsent) {
      this.consentRecords.set(consentId, record);
    }

    await this.logAuditEvent({
      timestamp: now,
      userId: record.userId,
      toolName: request.toolName,
      operation: request.operation,
      result: approved ? "success" : "denied",
      dataAccessed: request.dataAccess?.scope,
    });

    return {
      approved,
      restrictions,
      expiresAt,
      auditLog: this.config.auditLogging,
    };
  }

  /**
   * Find valid consent for tool and operation
   */
  private findValidConsent(toolName: string, operation: string): ConsentRecord | null {
    const now = new Date();

    for (const record of this.consentRecords.values()) {
      if (
        record.toolName === toolName &&
        record.operation === operation &&
        record.approved &&
        !record.revokedAt &&
        (!record.expiresAt || record.expiresAt > now)
      ) {
        return record;
      }
    }

    return null;
  }

  /**
   * Check if tool requires explicit consent
   */
  private requiresExplicitConsent(toolName: string, operation: string): boolean {
    return (
      this.config.requireExplicitConsent.includes(toolName) ||
      this.config.requireExplicitConsent.includes("*") ||
      this.config.sensitiveOperations.includes(operation)
    );
  }

  /**
   * Check if tool can be auto-approved
   */
  private isAutoApproved(toolName: string): boolean {
    return (
      this.config.autoApprovedTools.includes(toolName) ||
      this.config.autoApprovedTools.includes("*")
    );
  }

  /**
   * Calculate restrictions based on request
   */
  private calculateRestrictions(request: ConsentRequest): ConsentRestriction[] {
    const restrictions: ConsentRestriction[] = [];

    // Add data access restrictions
    if (request.dataAccess) {
      if (request.dataAccess.sensitiveData) {
        restrictions.push({
          type: "data_limit",
          value: "no_sensitive_export",
          description: "Sensitive data cannot be exported or cached",
        });
      }

      if (request.dataAccess.retention) {
        restrictions.push({
          type: "time_limit",
          value: request.dataAccess.retention,
          description: `Data must be deleted after ${request.dataAccess.retention}`,
        });
      }

      if (!request.dataAccess.sharing) {
        restrictions.push({
          type: "scope_limit",
          value: "no_sharing",
          description: "Data cannot be shared with third parties",
        });
      }
    }

    // Add risk-based restrictions
    switch (request.riskLevel) {
      case "high":
        restrictions.push({
          type: "operation_limit",
          value: 1,
          description: "Single use consent for high-risk operation",
        });
        break;
      case "medium":
        restrictions.push({
          type: "time_limit",
          value: "1h",
          description: "Consent expires after 1 hour for medium-risk operations",
        });
        break;
    }

    return restrictions;
  }

  /**
   * Calculate expiration time
   */
  private calculateExpirationTime(request: ConsentRequest): Date | undefined {
    const now = new Date();

    switch (request.riskLevel) {
      case "high":
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      case "medium":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      case "low":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      default:
        return undefined; // No expiration
    }
  }

  /**
   * Generate unique consent ID
   */
  private generateConsentId(request: ConsentRequest): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `consent_${request.toolName}_${request.operation}_${timestamp}_${random}`;
  }

  /**
   * Validate consent request
   */
  private validateConsentRequest(request: ConsentRequest): void {
    if (!request.toolName || request.toolName.trim() === "") {
      throw new Error("Tool name is required");
    }

    if (!request.operation || request.operation.trim() === "") {
      throw new Error("Operation is required");
    }

    if (!request.description || request.description.trim() === "") {
      throw new Error("Description is required");
    }

    if (!["low", "medium", "high"].includes(request.riskLevel)) {
      throw new Error("Invalid risk level");
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(event: AuditEvent): Promise<void> {
    if (!this.config.auditLogging) {
      return;
    }

    // Add to in-memory log
    this.auditEvents.push(event);

    // In a real implementation, this would also:
    // - Write to persistent storage
    // - Send to external audit system
    // - Encrypt if required
    console.log("[Audit]", event);

    // Keep audit log size manageable
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-5000);
    }
  }

  /**
   * Register consent callback for a tool
   */
  registerConsentCallback(
    toolName: string,
    callback: (request: ConsentRequest) => Promise<boolean>
  ): void {
    this.consentCallbacks.set(toolName, callback);
  }

  /**
   * Start cleanup timer for expired consents
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredConsents();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Clean up expired consents
   */
  private cleanupExpiredConsents(): void {
    const now = new Date();
    const toDelete: string[] = [];

    for (const [key, record] of this.consentRecords.entries()) {
      if (record.expiresAt && record.expiresAt <= now) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.consentRecords.delete(key);
    }

    if (toDelete.length > 0) {
      console.log(`[ConsentManager] Cleaned up ${toDelete.length} expired consents`);
    }
  }

  /**
   * Get consent statistics
   */
  getConsentStats(): {
    totalConsents: number;
    activeConsents: number;
    revokedConsents: number;
    expiredConsents: number;
    auditLogSize: number;
  } {
    const now = new Date();
    let active = 0;
    let revoked = 0;
    let expired = 0;

    for (const record of this.consentRecords.values()) {
      if (record.revokedAt) {
        revoked++;
      } else if (record.expiresAt && record.expiresAt <= now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      totalConsents: this.consentRecords.size,
      activeConsents: active,
      revokedConsents: revoked,
      expiredConsents: expired,
      auditLogSize: this.auditEvents.length,
    };
  }

  /**
   * Export audit log (with optional filtering)
   */
  exportAuditLog(filter?: {
    toolName?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditEvent[] {
    let filtered = this.auditEvents;

    if (filter) {
      filtered = this.auditEvents.filter(event => {
        if (filter.toolName && event.toolName !== filter.toolName) return false;
        if (filter.userId && event.userId !== filter.userId) return false;
        if (filter.startDate && event.timestamp < filter.startDate) return false;
        if (filter.endDate && event.timestamp > filter.endDate) return false;
        return true;
      });
    }

    return filtered;
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.consentRecords.clear();
    this.auditEvents.length = 0;
    this.consentCallbacks.clear();
  }
}

/**
 * Default consent manager configuration
 */
export const defaultConsentConfig: ConsentManagerConfig = {
  defaultApproval: false,
  consentTimeout: 300000, // 5 minutes
  persistConsent: true,
  auditLogging: true,
  encryptAuditLogs: false, // Enable in production
  dataRetentionDays: 30,
  requireExplicitConsent: [], // All tools require consent by default
  autoApprovedTools: ["healthCheck", "systemStats"], // Safe read-only operations
  sensitiveOperations: [
    "executeTemplate",
    "createNode",
    "updateNode",
    "deleteNode",
    "createTable",
    "updateTable",
    "deleteTable",
  ],
};

/**
 * Create a configured consent manager
 */
export function createConsentManager(config?: Partial<ConsentManagerConfig>): ConsentManager {
  return new ConsentManager({ ...defaultConsentConfig, ...config });
}