/**
 * MCP Health Check Tool Test with Consent Validation
 *
 * Critical TDD test that MUST FAIL before implementation
 * Tests MCP 2025-06-18 compliance with consent framework
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import type {
  McpTool,
  McpToolCall,
  McpToolResult,
  ConsentRequest,
  ConsentResponse,
  SecurityContext,
} from "../../../src/mcp/types/McpTypes.js";
import { ConsentManager } from "../../../src/mcp/security/ConsentManager.js";

import { HealthCheckTool } from "../../../src/mcp/tools/query-tools/HealthCheckTool.js";

describe("MCP Health Check Tool", () => {
  let consentManager: ConsentManager;
  let securityContext: SecurityContext;
  let healthCheckTool: McpTool;

  beforeEach(() => {
    consentManager = new ConsentManager({
      defaultApproval: false,
      consentTimeout: 5000,
      persistConsent: true,
      auditLogging: true,
      encryptAuditLogs: false,
      dataRetentionDays: 30,
      requireExplicitConsent: ["healthCheck"],
      autoApprovedTools: [],
      sensitiveOperations: [],
    });

    securityContext = {
      userId: "test-user-001",
      sessionId: "test-session-001",
      permissions: ["mcp:tools:execute", "graphql:query"],
      trustLevel: "basic",
      auditEnabled: true,
    };

    healthCheckTool = new HealthCheckTool(consentManager);
  });

  afterEach(() => {
    consentManager.dispose();
  });

  test("should successfully import HealthCheckTool", () => {
    // This test should now pass since implementation exists
    expect(() => {
      require("../../../src/mcp/tools/query-tools/HealthCheckTool.js");
    }).not.toThrow();
  });

  test("should define proper MCP tool schema", async () => {
    // This test should now pass since the tool is implemented
    const metadata = healthCheckTool.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("healthCheck");
    expect(metadata.description).toContain("GraphQL server health");
    expect(metadata.inputSchema).toBeDefined();
    expect(metadata.inputSchema.type).toBe("object");
  });

  test("should require explicit consent for health check", async () => {
    const consentRequest: ConsentRequest = {
      toolName: "healthCheck",
      operation: "query",
      description: "Check GraphQL server health status",
      riskLevel: "low",
      dataAccess: {
        scope: ["system:health", "server:status"],
        purpose: "Health monitoring",
        retention: "1h",
        sharing: false,
        sensitiveData: false,
      },
    };

    // This will work since ConsentManager is implemented
    const response = await consentManager.requestConsent(consentRequest);
    expect(response.approved).toBe(false); // No auto-approval configured
  });

  test("should execute health check with valid consent", async () => {
    // Grant consent first
    consentManager.registerConsentCallback("healthCheck", async () => true);

    const toolCall: McpToolCall = {
      name: "healthCheck",
      arguments: {},
    };

    // This should now work since the tool is implemented
    const result = await healthCheckTool.execute(toolCall, securityContext);

    expect(result).toBeDefined();
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content?.length).toBeGreaterThan(0);

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      const response = JSON.parse(content.text);
      expect(response.data.healthCheck.status).toBe("OK");
      expect(response.data.healthCheck.database).toBeDefined();
      expect(response.data.healthCheck.version).toBeDefined();
    }
  });

  test("should reject execution without consent", async () => {
    const toolCall: McpToolCall = {
      name: "healthCheck",
      arguments: {},
    };

    // This should now work since the tool is implemented
    const result = await healthCheckTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content?.length).toBeGreaterThan(0);

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("consent denied");
    }
  });

  test("should validate input parameters", async () => {
    consentManager.registerConsentCallback("healthCheck", async () => true);

    const toolCall: McpToolCall = {
      name: "healthCheck",
      arguments: {
        invalidParam: "should be rejected",
      },
    };

    // This should now work since the tool is implemented
    const result = await healthCheckTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("invalid parameters");
    }
  });

  test("should log audit events", async () => {
    consentManager.registerConsentCallback("healthCheck", async () => true);

    const toolCall: McpToolCall = {
      name: "healthCheck",
      arguments: {},
    };

    const initialEvents = consentManager.exportAuditLog().length;

    // This should now work since the tool is implemented
    await healthCheckTool.execute(toolCall, securityContext);

    const finalEvents = consentManager.exportAuditLog().length;
    expect(finalEvents).toBeGreaterThan(initialEvents);

    const auditEvents = consentManager.exportAuditLog();
    const healthCheckEvents = auditEvents.filter(e => e.toolName === "healthCheck");
    expect(healthCheckEvents.length).toBeGreaterThan(0);
  });

  test("should handle GraphQL server connection errors", async () => {
    consentManager.registerConsentCallback("healthCheck", async () => true);

    // Simulate server connection error
    const toolCall: McpToolCall = {
      name: "healthCheck",
      arguments: {
        endpoint: "http://invalid-endpoint:9999/graphql",
      },
    };

    // This should now work since the tool is implemented
    const result = await healthCheckTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(false); // Tool handles errors gracefully
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      const response = JSON.parse(content.text);
      expect(response.data.healthCheck.status).toBe("ERROR");
      expect(response.data.healthCheck.database).toBe("error");
    }
  });

  test("should respect consent restrictions", async () => {
    // Set up consent with restrictions
    consentManager.registerConsentCallback("healthCheck", async () => true);

    const consentRequest: ConsentRequest = {
      toolName: "healthCheck",
      operation: "query",
      description: "Check GraphQL server health status",
      riskLevel: "medium", // This will add time restrictions
      dataAccess: {
        scope: ["system:health"],
        purpose: "Health monitoring",
        retention: "1h",
        sharing: false,
        sensitiveData: false,
      },
    };

    const response = await consentManager.requestConsent(consentRequest);
    expect(response.approved).toBe(true);
    expect(response.restrictions).toBeDefined();
    expect(response.restrictions?.length).toBeGreaterThan(0);
    expect(response.expiresAt).toBeDefined();
  });
});