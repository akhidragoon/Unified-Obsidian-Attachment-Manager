/**
 * Rollback Manager.
 *
 * Tracks vault-modifying operations so they can be undone.
 * Supports: file modifications, file creations, file deletions, file renames.
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';

export interface UndoEntry {
	id: string;
	timestamp: number;
	type: 'modify' | 'create' | 'createBinary' | 'delete' | 'rename';
	description: string;
	filePath: string;
	// Data needed to undo:
	oldContent?: string;       // for modify - previous file content
	oldPath?: string;          // for rename - previous path
	wasDirectory?: boolean;    // for delete - was it a folder?
}

export interface UndoResult {
	undone: boolean;
	undoneEntry?: UndoEntry;
	error?: string;
}

export class RollbackManager {
	private readonly app: App;
	private readonly history: UndoEntry[] = [];
	private readonly maxHistory: number;

	public constructor(app: App, maxHistory: number = 50) {
		this.app = app;
		this.maxHistory = maxHistory;
	}

	/**
	 * Record a file modification for potential undo.
	 */
	recordModify(filePath: string, oldContent: string, description: string): void {
		this.addEntry({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type: 'modify',
			description,
			filePath,
			oldContent,
		});
	}

	/**
	 * Record a file creation for potential undo.
	 */
	recordCreate(filePath: string, description: string): void {
		this.addEntry({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type: 'create',
			description,
			filePath,
		});
	}

	/**
	 * Record a binary file creation for potential undo.
	 */
	recordCreateBinary(filePath: string, description: string): void {
		this.addEntry({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type: 'createBinary',
			description,
			filePath,
		});
	}

	/**
	 * Record a file deletion for potential undo.
	 */
	recordDelete(filePath: string, wasDirectory: boolean, description: string): void {
		this.addEntry({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type: 'delete',
			description,
			filePath,
			wasDirectory,
		});
	}

	/**
	 * Record a file rename for potential undo.
	 */
	recordRename(oldPath: string, newPath: string, description: string): void {
		this.addEntry({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type: 'rename',
			description,
			filePath: newPath,
			oldPath,
		});
	}

	private addEntry(entry: UndoEntry): void {
		this.history.unshift(entry);
		if (this.history.length > this.maxHistory) {
			this.history.pop();
		}
	}

	/**
	 * Undo the last recorded operation.
	 */
	public async undo(): Promise<UndoResult> {
		const entry = this.history.shift();
		if (!entry) {
			return { undone: false, error: 'No operations to undo.' };
		}

		try {
			switch (entry.type) {
				case 'modify': {
					const file = this.app.vault.getAbstractFileByPath(entry.filePath) as TFile;
					if (file && entry.oldContent !== undefined) {
						await this.app.vault.modify(file, entry.oldContent);
					} else {
						return { undone: false, error: `File not found: ${entry.filePath}` };
					}
					break;
				}
				case 'create': {
					const file = this.app.vault.getAbstractFileByPath(entry.filePath) as TFile;
					if (file) {
						await this.app.vault.delete(file, true);
					}
					break;
				}
				case 'createBinary': {
					const file = this.app.vault.getAbstractFileByPath(entry.filePath) as TFile;
					if (file) {
						await this.app.vault.delete(file, true);
					}
					break;
				}
				case 'delete': {
					// Can't easily restore a deleted file without its content
					// We'd need to store the content, which we don't for deletes
					return { undone: false, error: `Cannot restore deleted file: ${entry.filePath}. Content was not saved.` };
				}
				case 'rename': {
					const file = this.app.vault.getAbstractFileByPath(entry.filePath) as TFile;
					if (file && entry.oldPath) {
						await this.app.vault.rename(file, entry.oldPath);
					} else {
						return { undone: false, error: `File not found: ${entry.filePath}` };
					}
					break;
				}
			}

			return { undone: true, undoneEntry: entry };
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			return { undone: false, error: msg };
		}
	}

	/**
	 * Get the history of operations that can be undone.
	 */
	public getHistory(): UndoEntry[] {
		return [...this.history];
	}

	/**
	 * Clear the undo history.
	 */
	public clear(): void {
		this.history.length = 0;
	}

	/**
	 * Get the number of operations that can be undone.
	 */
	public get undoableCount(): number {
		return this.history.length;
	}
}
