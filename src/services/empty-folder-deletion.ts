/**
 * Empty folder deletion.
 *
 * Sweeps the vault for empty folders left behind by deletions or moves,
 * and deletes them according to the configured behavior.
 */

import { App, TFolder, Notice, normalizePath } from 'obsidian';

export enum EmptyFolderBehavior {
	Keep = 'keep',
	Delete = 'delete',
	DeleteWithEmptyParents = 'delete-with-empty-parents'
}

export interface PluginNoticeComponent {
	showNotice(message: string): void;
}

export interface EmptyFolderOptions {
	abortSignal: AbortSignal;
	app: App;
	emptyFolderBehavior: EmptyFolderBehavior;
	isPathIgnored: (path: string, isFolder?: boolean) => boolean;
	pluginNoticeComponent: PluginNoticeComponent;
}

export interface EmptyFolderResult {
	deletedCount: number;
	errors: string[];
}

/**
 * Delete empty folders according to the configured behavior.
 */
export async function deleteEmptyFolders(options: EmptyFolderOptions): Promise<EmptyFolderResult> {
	const result: EmptyFolderResult = { deletedCount: 0, errors: [] };

	if (options.emptyFolderBehavior === EmptyFolderBehavior.Keep) {
		return result;
	}

	const folders = await collectEmptyFolders(options.app, options.isPathIgnored);
	const foldersToDelete = options.emptyFolderBehavior === EmptyFolderBehavior.DeleteWithEmptyParents
		? folders
		: folders.filter(f => !hasEmptyParentFolder(f, folders));

	// Delete deepest folders first
	foldersToDelete.sort((a, b) => b.split('/').length - a.split('/').length);

	for (const folderPath of foldersToDelete) {
		if (options.abortSignal.aborted) {
			break;
		}

		try {
			const folder = options.app.vault.getAbstractFileByPath(folderPath);
			if (!(folder instanceof TFolder)) continue;

			// Re-check emptiness (another deletion may have emptied it)
			if (folder.children.length > 0) continue;

			await options.app.vault.trash(folder, true);
			result.deletedCount++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			result.errors.push(`Failed to delete ${folderPath}: ${msg}`);
		}
	}

	if (options.pluginNoticeComponent?.showNotice) {
		if (result.deletedCount > 0) {
			options.pluginNoticeComponent.showNotice(`Deleted ${result.deletedCount} empty folder(s)`);
		} else {
			options.pluginNoticeComponent.showNotice('No empty folders found');
		}
	}

	return result;
}

/**
 * Collect all empty folders in the vault.
 */
async function collectEmptyFolders(
	app: App,
	isPathIgnored: (path: string, isFolder?: boolean) => boolean
): Promise<string[]> {
	const folders: string[] = [];

	const walk = (folder: TFolder) => {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				if (child.children.length === 0) {
					if (!isPathIgnored(child.path, true)) {
						folders.push(child.path);
					}
				} else {
					walk(child);
				}
			}
		}
	};

	const root = app.vault.getAbstractFileByPath('/');
	if (root instanceof TFolder) {
		walk(root);
	}

	return folders;
}

/**
 * Check if a folder has an empty parent folder in the list.
 */
function hasEmptyParentFolder(folderPath: string, allFolders: string[]): boolean {
	const parentPath = folderPath.substring(0, folderPath.lastIndexOf('/'));
	if (!parentPath) return false;
	return allFolders.includes(parentPath);
}
