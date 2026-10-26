/**
 * Resource locking (mutex) to prevent concurrent operations from corrupting state.
 *
 * Ensures that only one operation at a time can access a given resource (e.g., a file or the vault).
 * Uses a simple queue-based mutex - if a lock is held, subsequent lock requests wait in line.
 */

import { App } from 'obsidian';

interface QueuedLock {
	resolve: () => void;
	reject: (err: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class ResourceLock {
	private readonly app: App;
	private readonly locks = new Map<string, QueuedLock[]>();
	private readonly activeLocks = new Set<string>();

	public constructor(app: App) {
		this.app = app;
	}

	/**
	 * Acquire a lock for a given resource key.
	 * Returns a release function that must be called when done.
	 * Throws if the lock cannot be acquired within the timeout.
	 */
	public async acquire(key: string, timeoutMs: number = 5000): Promise<() => void> {
		if (!this.activeLocks.has(key)) {
			this.activeLocks.add(key);
			return () => this.release(key);
		}

		return new Promise<() => void>((resolve, reject) => {
			const queue: QueuedLock[] = this.locks.get(key) ?? [];
			const queuedLock: QueuedLock = { resolve: resolve as () => void, reject, timer: setTimeout(() => {}, 0) };
			queue.push(queuedLock);
			this.locks.set(key, queue);

			// Set a timeout to reject if we wait too long
			queuedLock.timer = setTimeout(() => {
				const idx = queue.findIndex(q => q.resolve === (resolve as () => void));
				if (idx >= 0) {
					queue.splice(idx, 1);
					this.locks.set(key, queue);
				}
				reject(new Error(`Lock timeout for key: ${key}`));
			}, timeoutMs);
		});
	}

	private release(key: string): void {
		const queue = this.locks.get(key);
		if (!queue || queue.length === 0) {
			this.activeLocks.delete(key);
			this.locks.delete(key);
			return;
		}

		const next = queue.shift();
		this.locks.set(key, queue);

		// Clear the timer for the next queued lock
		if (next) {
			clearTimeout(next.timer);
			next.resolve();
		} else {
			this.activeLocks.delete(key);
			this.locks.delete(key);
		}
	}

	/**
	 * Execute a function while holding a lock for the given key.
	 */
	public async withLock<T>(key: string, fn: () => Promise<T>, timeoutMs: number = 5000): Promise<T> {
		const release = await this.acquire(key, timeoutMs);
		try {
			return await fn();
		} finally {
			release();
		}
	}

	/**
	 * Check if a key is currently locked.
	 */
	public isLocked(key: string): boolean {
		return this.activeLocks.has(key);
	}

	/**
	 * Get the number of active locks.
	 */
	public get activeLockCount(): number {
		return this.activeLocks.size;
	}
}

export class ResourceLockManager {
	private readonly locks = new Map<string, ResourceLock>();

	public getLockForApp(app: App): ResourceLock {
		let lock = this.locks.get('app');
		if (!lock) {
			lock = new ResourceLock(app);
			this.locks.set('app', lock);
		}
		return lock;
	}
}
