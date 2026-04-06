/**
 * BASE Satellite Sync — Real-time PAUL project state sync
 * Reads paul.json from a satellite, syncs to workspace.json + projects.json
 * Called by PAUL at end of each loop phase (plan, apply, unify, handoff)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { validateSurface } from './validate.js';

function debugLog(...args) {
    console.error('[BASE:satellite]', new Date().toISOString(), ...args);
}

// ============================================================
// HELPERS
// ============================================================

function readJson(filepath) {
    if (!existsSync(filepath)) return null;
    try {
        return JSON.parse(readFileSync(filepath, 'utf-8'));
    } catch (e) {
        return null;
    }
}

function writeJson(filepath, data) {
    writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function formatTimestamp() {
    return new Date().toISOString();
}

function buildPaulField(paulData, satelliteName, satellitePath) {
    const phase = paulData.phase || {};
    const loop = paulData.loop || {};
    const handoff = paulData.handoff || {};
    const milestone = paulData.milestone || {};
    const timestamps = paulData.timestamps || {};

    const completedPhases = phase.status === 'complete'
        ? phase.number
        : Math.max(0, (phase.number || 1) - 1);

    return {
        is_paul_project: true,
        satellite_name: satelliteName,
        location: satellitePath + '/',
        milestone: milestone.name || null,
        phase: phase.name || null,
        phase_name: phase.name || null,
        loop_position: loop.position || 'IDLE',
        last_update: timestamps.updated_at || formatTimestamp(),
        handoff: handoff.present || false,
        handoff_path: handoff.path || null,
        completed_phases: completedPhases,
        total_phases: phase.total || null,
        last_plan_completed_at: paulData.last_plan_completed_at || null,
    };
}

function findProjectByPath(items, satellitePath) {
    const pathVariants = [
        satellitePath,
        satellitePath + '/',
        satellitePath.replace(/\/$/, ''),
    ];
    return items.find(item => {
        const loc = (item.location || '').replace(/\/$/, '');
        return pathVariants.some(v => v.replace(/\/$/, '') === loc);
    });
}

function findProjectBySatelliteName(items, name) {
    return items.find(item =>
        item.paul && item.paul.satellite_name === name
    );
}

// ============================================================
// SYNC LOGIC
// ============================================================

function syncSatellite(paulJsonPath, workspacePath) {
    const paulData = readJson(paulJsonPath);
    if (!paulData) throw new Error(`Cannot read paul.json at ${paulJsonPath}`);

    const name = paulData.name;
    if (!name) throw new Error('paul.json has no name field');

    // Derive paths
    const projectDir = join(paulJsonPath, '..', '..');
    const satellitePath = relative(workspacePath, projectDir);
    const phase = paulData.phase || {};
    const loop = paulData.loop || {};
    const handoff = paulData.handoff || {};
    const timestamps = paulData.timestamps || {};

    const result = { satellite: name, workspace_synced: false, project_synced: false, project_created: false };

    // --- Sync workspace.json ---
    const manifestPath = join(workspacePath, '.base', 'workspace.json');
    const manifest = readJson(manifestPath);
    if (manifest) {
        if (!manifest.satellites) manifest.satellites = {};
        const sat = manifest.satellites[name];

        if (sat) {
            // Update existing satellite
            sat.last_activity = timestamps.updated_at || formatTimestamp();
            sat.phase_name = phase.name;
            sat.phase_number = phase.number;
            sat.phase_status = phase.status;
            sat.loop_position = loop.position;
            sat.handoff = handoff.present || false;
            sat.last_plan_completed_at = paulData.last_plan_completed_at;
            result.workspace_synced = true;
        } else {
            // New satellite — register
            manifest.satellites[name] = {
                path: satellitePath,
                engine: 'paul',
                state: satellitePath + '/.paul/STATE.md',
                registered: new Date().toISOString().split('T')[0],
                groom_check: true,
                last_activity: timestamps.updated_at || formatTimestamp(),
                phase_name: phase.name,
                phase_number: phase.number,
                phase_status: phase.status,
                loop_position: loop.position,
                handoff: handoff.present || false,
                last_plan_completed_at: paulData.last_plan_completed_at,
            };
            result.workspace_synced = true;
        }

        writeJson(manifestPath, manifest);
    }

    // --- Sync projects.json ---
    const projectsPath = join(workspacePath, '.base', 'data', 'projects.json');
    const projectsData = readJson(projectsPath);
    if (projectsData) {
        let project = findProjectBySatelliteName(projectsData.items, name)
            || findProjectByPath(projectsData.items, satellitePath);

        const paulField = buildPaulField(paulData, name, satellitePath);

        if (project) {
            // Update existing — merge paul field, preserve user-set fields
            if (!project.paul) project.paul = {};
            Object.assign(project.paul, paulField);
            project.updated_at = formatTimestamp();
            result.project_synced = true;
        } else {
            // Auto-create project entry
            const maxNum = projectsData.items
                .filter(i => (i.id || '').startsWith('PRJ-'))
                .reduce((max, i) => {
                    const n = parseInt((i.id || '').replace('PRJ-', ''), 10);
                    return n > max ? n : max;
                }, 0);

            const newId = `PRJ-${String(maxNum + 1).padStart(3, '0')}`;
            const title = paulData.project?.title || name;
            const now = formatTimestamp();

            projectsData.items.push({
                id: newId,
                title,
                type: 'project',
                parent_id: null,
                status: 'in_progress',
                priority: 'medium',
                category: 'internal',
                assignees: [],
                start_date: null,
                due_date: null,
                created_at: now,
                updated_at: now,
                location: satellitePath + '/',
                blocked_by: null,
                next: null,
                notes: [],
                tags: [],
                paul: paulField,
                relations: [],
                description: null,
            });
            result.project_created = true;
            result.project_id = newId;
        }

        projectsData.last_modified = formatTimestamp();
        validateSurface('projects', projectsData);
        writeJson(projectsPath, projectsData);
    }

    debugLog(`Synced satellite: ${name} (ws:${result.workspace_synced}, prj:${result.project_synced}, new:${result.project_created})`);
    return result;
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================

export const TOOLS = [
    {
        name: "base_sync_satellite",
        description: "Sync a PAUL satellite's state to workspace.json and projects.json. Reads paul.json, updates satellite entry and matching project. Creates project entry if none exists. Call after plan/apply/unify/handoff.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Workspace-relative path to the PAUL project (e.g., 'apps/my-app')" },
            },
            required: ["path"]
        }
    }
];

// ============================================================
// HANDLER DISPATCH
// ============================================================

export function handleTool(name, args, workspacePath) {
    switch (name) {
        case 'base_sync_satellite': {
            const { path: projectPath } = args;
            if (!projectPath) throw new Error('Missing required parameter: path');

            const paulJsonPath = join(workspacePath, projectPath, '.paul', 'paul.json');
            if (!existsSync(paulJsonPath)) {
                throw new Error(`No paul.json found at ${projectPath}/.paul/paul.json`);
            }

            return syncSatellite(paulJsonPath, workspacePath);
        }
        default:
            return null;
    }
}
