/**
 * MCP Template Execution Tool Test with User Authorization
 *
 * Critical TDD test that MUST FAIL before implementation
 * Tests MCP 2025-06-18 compliance with user authorization and consent
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

import { TemplateExecutionTool } from "../../../src/mcp/tools/mutation-tools/TemplateExecutionTool.js";

describe("MCP Template Execution Tool", () => {
  let consentManager: ConsentManager;
  let securityContext: SecurityContext;
  let templateExecutionTool: McpTool;

  beforeEach(() => {
    consentManager = new ConsentManager({
      defaultApproval: false,
      consentTimeout: 5000,
      persistConsent: true,
      auditLogging: true,
      encryptAuditLogs: false,
      dataRetentionDays: 30,
      requireExplicitConsent: ["executeTemplate"],
      autoApprovedTools: [],
      sensitiveOperations: ["executeTemplate"],
    });

    securityContext = {
      userId: "test-user-002",
      sessionId: "test-session-002",
      permissions: ["mcp:tools:execute", "graphql:mutation", "template:execute"],
      trustLevel: "elevated",
      auditEnabled: true,
    };

    templateExecutionTool = new TemplateExecutionTool(consentManager);
  });

  afterEach(() => {
    consentManager.dispose();
  });

  test("should successfully import TemplateExecutionTool", () => {
    // This test should now pass since implementation exists
    expect(() => {
      require("../../../src/mcp/tools/mutation-tools/TemplateExecutionTool.js");
    }).not.toThrow();
  });

  test("should define proper MCP tool schema with parameters", async () => {
    // This test should now pass since the tool is implemented
    const metadata = templateExecutionTool.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("executeTemplate");
    expect(metadata.description).toContain("Execute parameterized GraphQL template");
    expect(metadata.inputSchema).toBeDefined();
    expect(metadata.inputSchema.type).toBe("object");
    expect(metadata.inputSchema.properties).toBeDefined();
    expect(metadata.inputSchema.properties?.templateIdentifier).toBeDefined();
    expect(metadata.inputSchema.properties?.variables).toBeDefined();
    expect(metadata.inputSchema.required).toContain("templateIdentifier");
  });

  test("should require explicit consent for template execution", async () => {
    const consentRequest: ConsentRequest = {
      toolName: "executeTemplate",
      operation: "mutation",
      description: "Execute parameterized GraphQL template with variables",
      riskLevel: "high", // Template execution is high risk
      dataAccess: {
        scope: ["graphql:mutation", "database:write", "template:execute"],
        purpose: "Template execution with user data",
        retention: "indefinite", // Template results may be stored
        sharing: false,
        sensitiveData: true, // May access sensitive user data
      },
      userContext: {
        userId: securityContext.userId,
        sessionId: securityContext.sessionId,
      },
    };

    // This will work since ConsentManager is implemented
    const response = await consentManager.requestConsent(consentRequest);
    expect(response.approved).toBe(false); // No auto-approval for high-risk operations
  });

  test("should execute template with valid consent and parameters", async () => {
    // Grant consent first
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "system-health-check_v1-0-0",
        variables: {},
      },
    };

    // This should now work since the tool is implemented
    const result = await templateExecutionTool.execute(toolCall, securityContext);

    expect(result).toBeDefined();
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content?.length).toBeGreaterThan(0);

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      const response = JSON.parse(content.text);
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.templateIdentifier).toBe("system-health-check_v1-0-0");
    }
  });

  test("should reject execution without consent", async () => {
    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "create-node-with-params_v1-1-0",
        variables: { name: "Test Node" },
      },
    };

    // This should now work since the tool is implemented
    const result = await templateExecutionTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("consent denied");
    }
  });

  test("should validate required parameters", async () => {
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        // Missing required templateIdentifier
        variables: { name: "Test" },
      },
    };

    // This should now work since the tool is implemented
    const result = await templateExecutionTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("templateIdentifier is required");
    }
  });

  test("should handle template not found error", async () => {
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "non-existent-template_v1-0-0",
        variables: {},
      },
    };

    // This should now work since the tool is implemented
    const result = await templateExecutionTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("template not found");
    }
  });

  test("should execute template with variables", async () => {
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "create-node-with-params_v1-1-0",
        variables: {
          tableId: "12345",
          name: "Test Node",
          content: "Test content for MCP integration",
        },
      },
    };

    // This should now work since the tool is implemented
    const result = await templateExecutionTool.execute(toolCall, securityContext);

    expect(result).toBeDefined();
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      const response = JSON.parse(content.text);
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.variables).toEqual({
        tableId: "12345",
        name: "Test Node",
        content: "Test content for MCP integration",
      });
    }
  });

  test("should log detailed audit events for template execution", async () => {
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "system-health-check_v1-0-0",
        variables: {},
      },
    };

    const initialEvents = consentManager.exportAuditLog().length;

    // This should now work since the tool is implemented
    await templateExecutionTool.execute(toolCall, securityContext);

    const finalEvents = consentManager.exportAuditLog().length;
    expect(finalEvents).toBeGreaterThan(initialEvents);

    const auditEvents = consentManager.exportAuditLog();
    const templateEvents = auditEvents.filter(e => e.toolName === "executeTemplate");
    expect(templateEvents.length).toBeGreaterThan(0);

    const lastEvent = templateEvents[templateEvents.length - 1];
    expect(lastEvent.userId).toBe(securityContext.userId);
    expect(lastEvent.dataAccessed).toContain("template:execute");
  });

  test("should respect consent restrictions for high-risk operations", async () => {
    // Set up consent with strict restrictions
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const consentRequest: ConsentRequest = {
      toolName: "executeTemplate",
      operation: "mutation",
      description: "Execute high-risk template operation",
      riskLevel: "high",
      dataAccess: {
        scope: ["database:write", "template:execute"],
        purpose: "Template execution",
        retention: "immediate_delete",
        sharing: false,
        sensitiveData: true,
      },
    };

    const response = await consentManager.requestConsent(consentRequest);
    expect(response.approved).toBe(true);
    expect(response.restrictions).toBeDefined();
    expect(response.restrictions?.length).toBeGreaterThan(0);

    // Check for single-use restriction
    const singleUseRestriction = response.restrictions?.find(
      r => r.type === "operation_limit" && r.value === 1
    );
    expect(singleUseRestriction).toBeDefined();
    expect(singleUseRestriction?.description).toContain("single use");
  });

  test("should handle GraphQL execution errors gracefully", async () => {
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "invalid-syntax-template_v1-0-0",
        variables: { invalidParam: "test" },
      },
    };

    // This should now work since the tool is implemented
    const result = await templateExecutionTool.execute(toolCall, securityContext);

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("GraphQL execution error");
    }
  });

  test("should validate security context permissions", async () => {
    consentManager.registerConsentCallback("executeTemplate", async () => true);

    const insufficientSecurityContext: SecurityContext = {
      userId: "test-user-003",
      sessionId: "test-session-003",
      permissions: ["mcp:tools:execute"], // Missing template:execute permission
      trustLevel: "basic",
      auditEnabled: true,
    };

    const toolCall: McpToolCall = {
      name: "executeTemplate",
      arguments: {
        templateIdentifier: "system-health-check_v1-0-0",
        variables: {},
      },
    };

    // This will fail until the tool is implemented
    // const result = await templateExecutionTool.execute(toolCall, insufficientSecurityContext);
    const result: McpToolResult = { content: [], isError: true };

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();

    const content = result.content?.[0];
    expect(content?.type).toBe("text");
    if (content?.type === "text") {
      expect(content.text).toContain("insufficient permissions");
    }
  });
});