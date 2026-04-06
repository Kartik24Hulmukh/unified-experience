#!/usr/bin/env node
/**
 * BASE MCP — Workspace Orchestration Server
 * Builder's Automated State Engine
 *
 * Project management, entities, state tracking, operator profile, and PSMM.
 * All data stored as JSON in .base/data/.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import path from 'path';
import { fileURLToPath } from 'url';

// Tool group imports
import { TOOLS as projectTools, handleTool as handleProject } from './tools/projects.js';
import { TOOLS as stateTools, handleTool as handleState } from './tools/state.js';
import { TOOLS as entityTools, handleTool as handleEntity } from './tools/entities.js';
import { TOOLS as operatorTools, handleTool as handleOperator } from './tools/operator.js';
import { TOOLS as psmmTools, handleTool as handlePsmm } from './tools/psmm.js';
import { TOOLS as satelliteTools, handleTool as handleSatellite } from './tools/satellite.js';

// ============================================================
// CONFIGURATION
// ============================================================

// Resolve workspace from this file's location: base-mcp/ → .base/ → workspace root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_PATH = path.resolve(__dirname, '../..');

function debugLog(...args) {
    console.error('[BASE]', new Date().toISOString(), ...args);
}

// ============================================================
// TOOL REGISTRY
// ============================================================

const ALL_TOOLS = [...projectTools, ...stateTools, ...entityTools, ...operatorTools, ...psmmTools, ...satelliteTools];

// Build handler lookup: tool name → handler function
const TOOL_HANDLERS = {};
for (const tool of projectTools) TOOL_HANDLERS[tool.name] = handleProject;
for (const tool of stateTools) TOOL_HANDLERS[tool.name] = handleState;
for (const tool of entityTools) TOOL_HANDLERS[tool.name] = handleEntity;
for (const tool of operatorTools) TOOL_HANDLERS[tool.name] = handleOperator;
for (const tool of psmmTools) TOOL_HANDLERS[tool.name] = handlePsmm;
for (const tool of satelliteTools) TOOL_HANDLERS[tool.name] = handleSatellite;

// ============================================================
// MCP SERVER
// ============================================================

const server = new Server({
    name: "base-mcp",
    version: "2.0.0",
}, {
    capabilities: {
        tools: {},
    },
});

debugLog('BASE MCP Server initialized');
debugLog('Workspace:', WORKSPACE_PATH);
debugLog('Tool groups: projects (%d), state (%d), entities (%d), operator (%d), psmm (%d), satellite (%d)',
    projectTools.length, stateTools.length, entityTools.length, operatorTools.length, psmmTools.length, satelliteTools.length);
debugLog('Total tools:', ALL_TOOLS.length);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    debugLog('List tools request');
    return { tools: ALL_TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    debugLog('Call tool:', name);

    try {
        const handler = TOOL_HANDLERS[name];
        if (!handler) {
            throw new Error(`Unknown tool: ${name}`);
        }

        const result = await handler(name, args || {}, WORKSPACE_PATH);

        if (result === null) {
            throw new Error(`Tool ${name} returned null — handler mismatch`);
        }

        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: false,
        };
    } catch (error) {
        debugLog('Error:', error.message);
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

// ============================================================
// RUN
// ============================================================

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("BASE MCP Server running on stdio");
}

try {
    await runServer();
} catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
}
