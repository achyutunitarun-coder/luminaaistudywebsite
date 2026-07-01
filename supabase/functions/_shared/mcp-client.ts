// ═══════════════════════════════════════════════════════════════════
// Lumina Computer — MCP (Model Context Protocol) Client
//
// Connects to external MCP servers and registers their tools
// with the local ToolRegistry. Supports the standard MCP HTTP
// transport with SSE streaming for tool execution.
//
// Protocol: https://spec.modelcontextprotocol.io/
// ═══════════════════════════════════════════════════════════════════

import type { Tool, ToolSchema } from "./computer-agent.ts";
import type { ToolRegistry } from "./computer-agent.ts";

// ── Types ───────────────────────────────────────────────────────────

export interface MCPServerConfig {
  name: string;
  url: string;           // MCP server base URL (HTTP)
  apiKey?: string;
  transport?: "http" | "sse";
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolCallResponse {
  content: Array<{ type: "text" | "image" | "resource"; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

// ── MCP Client ──────────────────────────────────────────────────────

export class MCPClient {
  private servers: Map<string, MCPServerConfig> = new Map();
  private toolCache: Map<string, MCPToolDefinition[]> = new Map();

  registerServer(config: MCPServerConfig): void {
    this.servers.set(config.name, config);
  }

  unregisterServer(name: string): void {
    this.servers.delete(name);
    this.toolCache.delete(name);
  }

  listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  async listTools(serverName: string): Promise<MCPToolDefinition[]> {
    const cached = this.toolCache.get(serverName);
    if (cached) return cached;

    const config = this.servers.get(serverName);
    if (!config) throw new Error(`MCP server '${serverName}' not registered`);

    try {
      const res = await fetch(`${config.url}/tools/list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`MCP server returned ${res.status}: ${await res.text().catch(() => "")}`);
      }

      const data = await res.json();
      const tools: MCPToolDefinition[] = data?.tools ?? data?.result?.tools ?? [];

      // Validate tool shape
      const valid = tools.filter((t: any) => t && typeof t.name === "string");
      this.toolCache.set(serverName, valid);
      return valid;
    } catch (e) {
      console.warn(`[mcp] failed to list tools from '${serverName}':`, e);
      return [];
    }
  }

  async callTool(serverName: string, request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const config = this.servers.get(serverName);
    if (!config) throw new Error(`MCP server '${serverName}' not registered`);

    try {
      const res = await fetch(`${config.url}/tools/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          name: request.name,
          arguments: request.arguments,
        }),
      });

      if (!res.ok) {
        return {
          content: [{ type: "text", text: `MCP call failed: HTTP ${res.status}` }],
          isError: true,
        };
      }

      const data = await res.json();
      const content = data?.content ?? data?.result?.content ?? [];
      const isError = data?.isError ?? false;
      return { content, isError };
    } catch (e) {
      return {
        content: [{ type: "text", text: `MCP call error: ${e instanceof Error ? e.message : String(e)}` }],
        isError: true,
      };
    }
  }

  /** Register all tools from all MCP servers into a ToolRegistry */
  async registerAllTools(registry: ToolRegistry): Promise<void> {
    for (const [serverName, config] of this.servers) {
      const tools = await this.listTools(serverName);
      for (const def of tools) {
        const schema: ToolSchema = {
          name: `mcp_${serverName}_${def.name}`,
          description: `[MCP ${serverName}] ${def.description ?? def.name}`,
          inputSchema: def.inputSchema ?? { type: "object", properties: {} },
        };

        const tool: Tool = {
          schema,
          async execute(args: Record<string, any>): Promise<string> {
            const mcpClient = new MCPClient();
            mcpClient.registerServer(config);
            const result = await mcpClient.callTool(serverName, { name: def.name, arguments: args });
            return result.content.map((c) => c.text ?? "[non-text content]").join("\n");
          },
        };

        registry.register(tool);
      }
    }
  }
}
