import { McpToolRegistry } from '../../src/application/services/McpToolRegistry'

export async function getExpectedRootMcpToolCount(): Promise<number> {
  const registry = new McpToolRegistry()
  await registry.initialize()
  return registry.getToolCount()
}

export async function getExpectedRootMcpToolNames(): Promise<string[]> {
  const registry = new McpToolRegistry()
  await registry.initialize()
  return registry.getAllTools().map((tool) => tool.name)
}
