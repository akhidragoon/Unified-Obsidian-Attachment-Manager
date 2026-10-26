import { App, TAbstractFile, TFile, TFolder, Vault, normalizePath } from 'obsidian';

/**
 * Detects whether a file is an attachment (image/document) vs a markdown note.
 * Matches Obsidian's treatment of `.excalidraw.md` as attachments when configured.
 */
export function isAttachmentFile(file: TAbstractFile, treatedAsAttachmentExtensions: string[] = ['.excalidraw.md']): boolean {
	if (!(file instanceof TFile)) {
		return false;
	}
	const name = file.name.toLowerCase();
	const extension = file.extension.toLowerCase();

	const attachmentExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'avif',
		'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'epub', 'mp3', 'mp4', 'wav', 'ogg', 'webm'];

	if (attachmentExtensions.includes(extension)) {
		return true;
	}

	// Handle .excalidraw.md pattern
	if (treatedAsAttachmentExtensions.some(ext => name.endsWith(ext))) {
		return true;
	}

	return false;
}

export function isNoteFile(file: TAbstractFile, treatedAsAttachmentExtensions: string[] = ['.excalidraw.md']): boolean {
	if (!(file instanceof TFile)) {
		return false;
	}
	if (file.extension !== 'md') {
		return false;
	}
	return !isAttachmentFile(file, treatedAsAttachmentExtensions);
}

/**
 * Gets the attachment folder path for a given note, matching Obsidian's attachment folder setting.
 * Mirrors the logic in buildAttachmentFolder from Save as Local Images.
 */
export function getAttachmentFolderForNote(app: App, notePath: string): string {
	const vault = app.vault as unknown as Record<string, unknown>;
	const config = (vault['config'] ?? {}) as Record<string, unknown>;
	const attachmentBase = config['attachmentFolderPath'] as string | undefined;

	const noteDir = notePath.substring(0, notePath.lastIndexOf('/'));
	const noteName = notePath.split('/').pop()?.replace(/\.md$/, '') ?? '';

	const subPath = noteDir ? `${noteDir}/${noteName}` : noteName;

	if (!attachmentBase || attachmentBase === '/') {
		return subPath;
	}

	if (attachmentBase === './') {
		return noteDir ? `${noteDir}/${noteName}` : noteName;
	}

	if (attachmentBase.startsWith('./')) {
		const relative = attachmentBase.substring(2);
		const base = noteDir ? `${noteDir}/${relative}` : relative;
		return `${base}/${noteName}`;
	}

	return `${attachmentBase}/${subPath}`;
}

/**
 * Result of moving attachments when a note is renamed.
 */
export interface RenameResult {
	movedCount: number;
	errors: string[];
}

/**
 * Moves all attachments referenced by a renamed note from the old attachment folder
 * to the new attachment folder, and updates all references in the note content.
 */
export async function moveAttachmentsOnNoteRename(
	app: App,
	oldPath: string,
	newPath: string,
	treatedAsAttachmentExtensions: string[] = ['.excalidraw.md'],
): Promise<RenameResult> {
	const result: RenameResult = { movedCount: 0, errors: [] };

	const oldNoteFile = app.vault.getAbstractFileByPath(oldPath);
	if (!(oldNoteFile instanceof TFile)) {
		result.errors.push(`Source file not found: ${oldPath}`);
		return result;
	}

	if (!isNoteFile(oldNoteFile, treatedAsAttachmentExtensions)) {
		return result; // Not a note, nothing to do
	}

	const oldAttachmentFolder = getAttachmentFolderForNote(app, oldPath);
	const newAttachmentFolder = getAttachmentFolderForNote(app, newPath);

	if (oldAttachmentFolder === newAttachmentFolder) {
		return result; // Same folder, nothing to move
	}

	// Ensure new attachment folder exists
	await ensureFolderExists(app.vault, newAttachmentFolder);

	// Read the note content
	const content = await app.vault.read(oldNoteFile);

	// Find all attachment references in the note
	const attachmentLinks = findAttachmentReferencesInContent(content);

	let movedCount = 0;

	for (const link of attachmentLinks) {
		const linkPath = normalizePath(link);
		const fileObj = app.vault.getAbstractFileByPath(linkPath);

		if (!(fileObj instanceof TFile) || !isAttachmentFile(fileObj, treatedAsAttachmentExtensions)) {
			continue;
		}

		// Check if the attachment is in the old attachment folder
		if (!isPathWithinFolder(fileObj.path, oldAttachmentFolder)) {
			continue;
		}

		const fileName = fileObj.name;
		const newPath = normalizePath(`${newAttachmentFolder}/${fileName}`);

		try {
			await app.vault.rename(fileObj, newPath);
			movedCount++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			result.errors.push(`Failed to move ${fileObj.path}: ${msg}`);
		}
	}

	// Update references in the note content to point to new paths
	if (movedCount > 0) {
		try {
			const updatedContent = updateAttachmentReferencesInContent(content, oldAttachmentFolder, newAttachmentFolder);
			if (updatedContent !== content) {
				await app.vault.modify(oldNoteFile, updatedContent);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			result.errors.push(`Failed to update references in ${oldPath}: ${msg}`);
		}
	}

	result.movedCount = movedCount;
	return result;
}

/**
 * Ensures a folder exists, creating parent folders as needed.
 */
async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath);
	const existing = vault.getAbstractFileByPath?.(normalized);
	if (existing) return;

	const parts = normalized.split('/').filter(Boolean);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const found = vault.getAbstractFileByPath?.(current);
		if (!found) {
			await vault.createFolder?.(current);
		}
	}
}

/**
 * Finds all attachment file paths referenced in note content.
 * Looks at markdown images, links, wiki embeds/links, and HTML images.
 */
function findAttachmentReferencesInContent(content: string): string[] {
	const links: string[] = [];

	// Markdown images: ![alt](url)
	const mdImageRe = /!\[[^\]]*\]\(([^)\s]+)/g;
	let match: RegExpExecArray | null;
	while ((match = mdImageRe.exec(content)) !== null) {
		const url = (match[1] ?? '').trim();
		if (url && !url.startsWith('http') && !url.startsWith('#')) {
			links.push(url);
		}
	}
	mdImageRe.lastIndex = 0;

	// Markdown links: [text](url)
	const mdLinkRe = /\[[^\]]+\]\(([^)\s]+)/g;
	while ((match = mdLinkRe.exec(content)) !== null) {
		const url = (match[1] ?? '').trim();
		if (url && !url.startsWith('http') && !url.startsWith('#')) {
			links.push(url);
		}
	}
	mdLinkRe.lastIndex = 0;

	// Wiki embeds: ![[url]]
	const wikiEmbedRe = /!\[\[([^\]]+)\]\]/g;
	while ((match = wikiEmbedRe.exec(content)) !== null) {
		const url = (match[1] ?? '').trim();
		if (url && !url.startsWith('http') && !url.startsWith('#')) {
			links.push(url);
		}
	}
	wikiEmbedRe.lastIndex = 0;

	// Wiki links: [[url]]
	const wikiLinkRe = /\[\[([^\]]+)\]\]/g;
	while ((match = wikiLinkRe.exec(content)) !== null) {
		const url = (match[1] ?? '').trim();
		if (url && !url.startsWith('http') && !url.startsWith('#')) {
			links.push(url);
		}
	}
	wikiLinkRe.lastIndex = 0;

	// HTML images: <img src="url">
	const htmlImgRe = /<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi;
	while ((match = htmlImgRe.exec(content)) !== null) {
		const url = (match[1] ?? '').trim();
		if (url && !url.startsWith('http') && !url.startsWith('#')) {
			links.push(url);
		}
	}
	htmlImgRe.lastIndex = 0;

	return links;
}

/**
 * Checks if a path is within a given folder.
 */
function isPathWithinFolder(filePath: string, folderPath: string): boolean {
	if (!folderPath) {
		return false;
	}
	const normalizedFolder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
	return filePath.startsWith(normalizedFolder);
}

/**
 * Updates attachment references in content when moving from old folder to new folder.
 * Only updates references that point to files within the old attachment folder.
 */
function updateAttachmentReferencesInContent(
	content: string,
	oldFolder: string,
	newFolder: string,
): string {
	let result = content;

	// For each reference, check if it points to old folder and replace with new folder
	const allRefs = findAttachmentReferencesInContent(content);
	const seen = new Set<string>();

	for (const ref of allRefs) {
		if (seen.has(ref)) continue;
		seen.add(ref);

		const refPath = normalizePath(ref);
		if (!isPathWithinFolder(refPath, oldFolder)) continue;

		const fileName = refPath.split('/').pop() ?? refPath;
		const newRef = normalizePath(`${newFolder}/${fileName}`);

		// Replace all occurrences of this reference
		const escapedRef = escapeForRegex(ref);
		result = result.replace(new RegExp(escapedRef, 'g'), newRef);
	}

	return result;
}

/**
 * Escapes a string for use in a regular expression.
 */
function escapeForRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cleans up orphaned attachments when a note is deleted.
 * Removes attachments that are only referenced by the deleted note and are in its attachment folder.
 */
export async function cleanupAttachmentsOnNoteDelete(
	app: App,
	deletedNotePath: string,
	treatedAsAttachmentExtensions: string[] = ['.excalidraw.md'],
): Promise<{ deletedCount: number; errors: string[] }> {
	const result: { deletedCount: number; errors: string[] } = { deletedCount: 0, errors: [] };

	const noteFile = app.vault.getAbstractFileByPath(deletedNotePath);
	if (!(noteFile instanceof TFile) || !isNoteFile(noteFile, treatedAsAttachmentExtensions)) {
		return result;
	}

	const attachmentFolder = getAttachmentFolderForNote(app, deletedNotePath);
	if (!attachmentFolder) {
		return result;
	}

	// Read the note content to find which attachments it references
	const content = await app.vault.read(noteFile);
	const referencedLinks = findAttachmentReferencesInContent(content);
	const referencedPaths = new Set<string>();

	for (const link of referencedLinks) {
		const linkPath = normalizePath(link);
		const fileObj = app.vault.getAbstractFileByPath(linkPath);
		if (fileObj instanceof TFile && isAttachmentFile(fileObj, treatedAsAttachmentExtensions)) {
			referencedPaths.add(fileObj.path);
		}
	}

	// Get all files in the attachment folder
	const folderFile = app.vault.getAbstractFileByPath(attachmentFolder);
	if (!(folderFile instanceof TFolder)) {
		return result;
	}

	const filesToDelete: TFile[] = [];
	const walk = (f: TFolder) => {
		for (const child of f.children) {
			if (child instanceof TFile && isAttachmentFile(child, treatedAsAttachmentExtensions)) {
				if (!referencedPaths.has(child.path)) {
					filesToDelete.push(child);
				}
			} else if (child instanceof TFolder) {
				walk(child);
			}
		}
	};
	walk(folderFile);

	for (const file of filesToDelete) {
		try {
			await app.vault.trash(file, true);
			result.deletedCount++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			result.errors.push(`Failed to delete ${file.path}: ${msg}`);
		}
	}

	return result;
}
