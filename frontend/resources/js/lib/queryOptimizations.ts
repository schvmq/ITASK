import { Task, Project } from '@/types';

/**
 * Optimized In-Memory Task Index for O(1) Concurrent Access & Filtering.
 * Pre-indexes task collections across:
 * - projectId
 * - status
 * - dueDate
 */
export class TaskIndex {
    private byId: Map<string | number, Task> = new Map();
    private byProjectId: Map<string | number, Set<string | number>> = new Map();
    private byStatus: Map<string, Set<string | number>> = new Map();
    private byDueDate: Map<string, Set<string | number>> = new Map();

    constructor(tasks: Task[] = []) {
        this.indexAll(tasks);
    }

    public indexAll(tasks: Task[]): void {
        this.clear();
        for (const task of tasks) {
            this.add(task);
        }
    }

    public clear(): void {
        this.byId.clear();
        this.byProjectId.clear();
        this.byStatus.clear();
        this.byDueDate.clear();
    }

    public add(task: Task): void {
        this.byId.set(task.id, task);

        // Index by Project ID
        if (task.projectId !== undefined && task.projectId !== null) {
            if (!this.byProjectId.has(task.projectId)) {
                this.byProjectId.set(task.projectId, new Set());
            }
            this.byProjectId.get(task.projectId)!.add(task.id);
        }

        // Index by Status
        const statusKey = (task.status || '').toLowerCase().trim();
        if (statusKey) {
            if (!this.byStatus.has(statusKey)) {
                this.byStatus.set(statusKey, new Set());
            }
            this.byStatus.get(statusKey)!.add(task.id);
        }

        // Index by Due Date (YYYY-MM-DD)
        if (task.dueDate) {
            const dateKey = task.dueDate.slice(0, 10);
            if (!this.byDueDate.has(dateKey)) {
                this.byDueDate.set(dateKey, new Set());
            }
            this.byDueDate.get(dateKey)!.add(task.id);
        }
    }

    /**
     * O(1) lookup by task ID
     */
    public getById(id: string | number): Task | undefined {
        return this.byId.get(id);
    }

    /**
     * O(1) lookup of all tasks by project ID
     */
    public getByProjectId(projectId: string | number): Task[] {
        const ids = this.byProjectId.get(projectId);
        if (!ids) return [];
        const result: Task[] = [];
        ids.forEach((id) => {
            const t = this.byId.get(id);
            if (t) result.push(t);
        });
        return result;
    }

    /**
     * O(1) lookup of all tasks by status
     */
    public getByStatus(status: string): Task[] {
        const ids = this.byStatus.get(status.toLowerCase().trim());
        if (!ids) return [];
        const result: Task[] = [];
        ids.forEach((id) => {
            const t = this.byId.get(id);
            if (t) result.push(t);
        });
        return result;
    }

    /**
     * O(1) lookup of all tasks by due date
     */
    public getByDueDate(date: string): Task[] {
        const dateKey = date.slice(0, 10);
        const ids = this.byDueDate.get(dateKey);
        if (!ids) return [];
        const result: Task[] = [];
        ids.forEach((id) => {
            const t = this.byId.get(id);
            if (t) result.push(t);
        });
        return result;
    }

    /**
     * Get all indexed tasks
     */
    public getAll(): Task[] {
        return Array.from(this.byId.values());
    }

    /**
     * Calculate project completion percentage reactively derived from constituent tasks
     */
    public calculateProjectProgress(projectId: string | number): {
        total: number;
        completed: number;
        percentage: number;
    } {
        const tasks = this.getByProjectId(projectId);
        const total = tasks.length;
        if (total === 0) return { total: 0, completed: 0, percentage: 0 };

        const completed = tasks.filter(
            (t) => (t.status || '').toLowerCase() === 'completed'
        ).length;

        const percentage = Math.round((completed / total) * 100);
        return { total, completed, percentage };
    }
}

/**
 * Cache for reactively computed project completion percentages
 */
const progressCache = new Map<string | number, { percentage: number; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30s TTL

export function getCachedProjectProgress(
    projectId: string | number,
    computeFn: () => number
): number {
    const cached = progressCache.get(projectId);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.percentage;
    }
    const computed = computeFn();
    progressCache.set(projectId, { percentage: computed, timestamp: now });
    return computed;
}

export function invalidateProjectProgressCache(projectId?: string | number): void {
    if (projectId !== undefined) {
        progressCache.delete(projectId);
    } else {
        progressCache.clear();
    }
}
