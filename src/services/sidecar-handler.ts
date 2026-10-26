/**
 * Sidecar Notes handler.
 *
 * Handles sidecar files (e.g. .excalidraw.md files for Excalidraw drawings) that are
 * logically part of a note but stored as separate files. When a note is renamed, moved,
 * or deleted, its sidecar files should be renamed, moved, or deleted too.
 */

import { App, TAbstractFile, TFile, TFolder } from 'obsidian';

/**
 * Extensions that indicate a file is a sidecar of a markdown note.
 * .excalidraw.md is the standard Excalidraw sidecar format.
 */
export const SIDECAR_EXTENSIONS = ['.excalidraw.md'];

/**
 * Check if a file is a sidecar file (e.g. note.excalidraw.md is a sidecar of note.md).
 */
export function isSidecarFile(file: TAbstractFile): boolean {
	if (!(file instanceof TFile)) {
		return false;
	}
	const name = file.name.toLowerCase();
	return SIDECAR_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Get the sidecar file path for a given note path.
 * E.g. "notes/meeting.md" -> "notes/meeting.excalidraw.md"
 */
export function getSidecarPath(notePath: string): string {
	const base = notePath.endsWith('.md') ? notePath.slice(0, -3) : notePath;
	return `${base}.excalidraw.md`;
}

/**
 * Get the note path for a given sidecar path.
 * E.g. "notes/meeting.excalidraw.md" -> "notes/meeting.md"
 */
export function getNotePathFromSidecar(sidecarPath: string): string {
	const base = sidecarPath.endsWith('.excalidraw.md')
		? sidecarPath.slice(0, -'.excalidraw.md'.length)
		: sidecarPath;
	return `${base}.md`;
}

/**
 * Check if a sidecar file exists for a given note.
 */
export function sidecarExists(app: App, notePath: string): boolean {
	const sidecarPath = getSidecarPath(notePath);
	return app.vault.getAbstractFileByPath(sidecarPath) !== null;
}

/**
 * Get the sidecar file for a given note, if it exists.
 */
export function getSidecarFile(app: App, notePath: string): TFile | null {
	const sidecarPath = getSidecarPath(notePath);
	const file = app.vault.getAbstractFileByPath(sidecarPath);
	return file instanceof TFile ? file : null;
}

/**
 * Move a sidecar file along with its note during rename.
 */
export async function moveSidecarOnNoteRename(
	app: App,
	oldNotePath: string,
	newNotePath: string,
): Promise<{ moved: boolean; error?: string }> {
	const oldSidecarPath = getSidecarPath(oldNotePath);
	const newSidecarPath = getSidecarPath(newNotePath);

	const sidecarFile = app.vault.getAbstractFileByPath(oldSidecarPath);
	if (!(sidecarFile instanceof TFile)) {
		return { moved: false }; // No sidecar exists
	}

	try {
		await app.vault.rename(sidecarFile, newSidecarPath);
		return { moved: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		return { moved: false, error: msg };
	}
}

/**
 * Delete a sidecar file when its note is deleted.
 */
export async function deleteSidecarOnNoteDelete(
	app: App,
	notePath: string,
): Promise<{ deleted: boolean; error?: string }> {
	const sidecarPath = getSidecarPath(notePath);
	const sidecarFile = app.vault.getAbstractFileByPath(sidecarPath);
	if (!(sidecarFile instanceof TFile)) {
		return { deleted: false }; // No sidecar exists
	}

	try {
		await app.vault.trash(sidecarFile, true);
		return { deleted: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		return { deleted: false, error: msg };
	}
}

/**
 * Find all sidecar files in a folder recursively.
 */
export function findSidecarFilesInFolder(folder: TFolder): TFile[] {
	const sidecars: TFile[] = [];
	const walk = (f: TFolder) => {
		for (const child of f.children) {
			if (child instanceof TFile && isSidecarFile(child)) {
				sidecars.push(child);
			} else if (child instanceof TFolder) {
				walk(child);
			}
		}
	};
	walk(folder);
	return sidecars;
}

/**
 * Result of renaming a note with its sidecar.
 */
export interface NoteWithSidecarRenameResult {
	noteMoved: boolean;
	sidecarMoved: boolean;
	errors: string[];
}

/**
 * Rename a note and its sidecar file together.
 */
export async function renameNoteWithSidecar(
	app: App,
	oldNotePath: string,
	newNotePath: string,
): Promise<NoteWithSidecarRenameResult> {
	const result: NoteWithSidecarRenameResult = {
		noteMoved: false,
		sidecarMoved: false,
		errors: [],
	};

	const noteFile = app.vault.getAbstractFileByPath(oldNotePath);
	if (!(noteFile instanceof TFile)) {
		result.errors.push(`Note not found: ${oldNotePath}`);
		return result;
	}

	try {
		await app.vault.rename(noteFile, newNotePath);
		result.noteMoved = true;
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		result.errors.push(`Failed to rename note: ${msg}`);
		return result;
	}

	const sidecarResult = await moveSidecarOnNoteRename(app, oldNotePath, newNotePath);
	result.sidecarMoved = sidecarResult.moved;
	if (sidecarResult.error) {
		result.errors.push(sidecarResult.error);
	}

	return result;
}

/**
 * Delete a note and its sidecar file together.
 */
export interface NoteWithSidecarDeleteResult {
	noteDeleted: boolean;
	sidecarDeleted: boolean;
	errors: string[];
}

export async function deleteNoteWithSidecar(
	app: App,
	notePath: string,
): Promise<NoteWithSidecarDeleteResult> {
	const result: NoteWithSidecarDeleteResult = {
		noteDeleted: false,
		sidecarDeleted: false,
		errors: [],
	};

	const noteFile = app.vault.getAbstractFileByPath(notePath);
	if (!(noteFile instanceof TFile)) {
		result.errors.push(`Note not found: ${notePath}`);
		return result;
	}

	try {
		await app.vault.trash(noteFile, true);
		result.noteDeleted = true;
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		result.errors.push(`Failed to delete note: ${msg}`);
		return result;
	}

	const sidecarResult = await deleteSidecarOnNoteDelete(app, notePath);
	result.sidecarDeleted = sidecarResult.deleted;
	if (sidecarResult.error) {
		result.errors.push(sidecarResult.error);
	}

	return result;
}

/**
 * Check if a path belongs to a sidecar file.
 */
export function isSidecarPath(path: string): boolean {
	return path.toLowerCase().endsWith('.excalidraw.md');
}

/**
 * Get all notes in a vault that have sidecar files.
 */
export function getNotesWithSidecars(app: App): { notePath: string; sidecarPath: string }[] {
	const results: { notePath: string; sidecarPath: string }[] = [];

	for (const file of app.vault.getAllLoadedFiles()) {
		if (file instanceof TFile && isSidecarFile(file)) {
			const notePath = getNotePathFromSidecar(file.path);
			results.push({ notePath, sidecarPath: file.path });
		}
	}

	return results;
}
