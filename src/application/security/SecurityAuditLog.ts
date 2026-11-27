import type {
	AccessAction,
	AccessRole,
} from "@/application/security/AccessControl.js";

export interface SecurityAuditEvent {
	timestamp: string;
	outcome: "allowed" | "denied";
	code?: string;
	action: AccessAction;
	endpoint: string;
	principalId?: string;
	principalRole?: AccessRole;
	tableIds?: readonly string[];
}

export interface SecurityAuditListOptions {
	limit?: number;
	outcome?: "allowed" | "denied";
	principalId?: string;
}

export interface SecurityAuditLogOptions {
	maxEvents?: number;
	onEvent?: (event: SecurityAuditEvent) => void;
}

/**
 * Bounded in-memory ring buffer storing recent authentication and authorization decisions.
 */
export class SecurityAuditLog {
	private readonly maxEvents: number;
	private readonly onEvent?: (event: SecurityAuditEvent) => void;
	private readonly events: SecurityAuditEvent[] = [];

	constructor(options: SecurityAuditLogOptions = {}) {
		this.maxEvents = Math.max(10, options.maxEvents ?? 1_000);
		this.onEvent = options.onEvent;
	}

	record(event: SecurityAuditEvent): void {
		this.events.push(event);
		if (this.events.length > this.maxEvents) {
			this.events.splice(0, this.events.length - this.maxEvents);
		}
		this.onEvent?.(event);
	}

	list(options: SecurityAuditListOptions = {}): readonly SecurityAuditEvent[] {
		let filtered = this.events;
		if (options.outcome) {
			filtered = filtered.filter((entry) => entry.outcome === options.outcome);
		}
		if (options.principalId) {
			filtered = filtered.filter(
				(entry) => entry.principalId === options.principalId,
			);
		}
		const limit = options.limit ?? 100;
		if (limit <= 0) return [];
		return filtered.slice(-limit).reverse();
	}

	clear(): void {
		this.events.length = 0;
	}

	get size(): number {
		return this.events.length;
	}
}
