export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export interface ToolContext {
  frappePath: string;
  defaultSite: string;
  runBenchCommand: (args: { command: string; site?: string; cwd?: string }) => Promise<ToolResult>;
  getAppPath: (appName: string) => string;
  getModulePath: (appName: string, moduleName: string) => string;
  getDoctypePath: (appName: string, moduleName: string, doctypeName: string) => string;
}

export interface ToolModule {
  definitions: ToolDefinition[];
  handleToolCall: (name: string, args: any, context: ToolContext) => Promise<ToolResult | null>;
}
