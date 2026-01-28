import * as fs from 'fs';
import * as path from 'path';

// Types for local storage
export interface LocalTaskGroup {
    id: number;
    name: string;
    description: string | null;
    color: string;
    createdAt: string;
    updatedAt: string;
}

export interface LocalTaskConfig {
    pm2Id: number;
    groupId: number | null;
}

interface LocalStorage {
    groups: LocalTaskGroup[];
    configs: LocalTaskConfig[];
    nextGroupId: number;
}

const DATA_FILE = path.join(process.cwd(), '.pm2-manager-data.json');

function loadData(): LocalStorage {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const content = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.warn('[LocalStorage] Failed to load data:', error);
    }
    return { groups: [], configs: [], nextGroupId: 1 };
}

function saveData(data: LocalStorage): void {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('[LocalStorage] Failed to save data:', error);
    }
}

// Task Group operations
export function getAllTaskGroupsLocal(): LocalTaskGroup[] {
    const data = loadData();
    return data.groups.sort((a, b) => a.name.localeCompare(b.name));
}

export function getTaskGroupByIdLocal(id: number): LocalTaskGroup | undefined {
    const data = loadData();
    return data.groups.find(g => g.id === id);
}

export function createTaskGroupLocal(group: { name: string; description?: string; color?: string }): LocalTaskGroup {
    const data = loadData();
    const now = new Date().toISOString();

    const newGroup: LocalTaskGroup = {
        id: data.nextGroupId++,
        name: group.name,
        description: group.description || null,
        color: group.color || '#3B82F6',
        createdAt: now,
        updatedAt: now,
    };

    data.groups.push(newGroup);
    saveData(data);

    return newGroup;
}

export function updateTaskGroupLocal(id: number, updates: { name?: string; description?: string; color?: string }): LocalTaskGroup | undefined {
    const data = loadData();
    const index = data.groups.findIndex(g => g.id === id);

    if (index === -1) return undefined;

    data.groups[index] = {
        ...data.groups[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    saveData(data);
    return data.groups[index];
}

export function deleteTaskGroupLocal(id: number): void {
    const data = loadData();

    // Remove group assignment from configs
    data.configs = data.configs.map(c =>
        c.groupId === id ? { ...c, groupId: null } : c
    );

    // Remove the group
    data.groups = data.groups.filter(g => g.id !== id);

    saveData(data);
}

// Task Config operations
export function getAllTaskConfigsLocal(): LocalTaskConfig[] {
    const data = loadData();
    return data.configs;
}

export function getTaskConfigByPm2IdLocal(pm2Id: number): LocalTaskConfig | undefined {
    const data = loadData();
    return data.configs.find(c => c.pm2Id === pm2Id);
}

export function updateTaskConfigGroupLocal(pm2Id: number, groupId: number | null): void {
    const data = loadData();
    const index = data.configs.findIndex(c => c.pm2Id === pm2Id);

    if (index === -1) {
        data.configs.push({ pm2Id, groupId });
    } else {
        data.configs[index].groupId = groupId;
    }

    saveData(data);
}
