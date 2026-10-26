/**
 * Frontmatter Title Preservation.
 *
 * When attachments are renamed or moved, preserve the original filename as an alias
 * or title in the frontmatter of referencing notes, so existing links continue to work
 * and the original name is not lost.
 */

import { App } from 'obsidian';
import { normalizePath } from 'obsidian';

export interface FrontmatterTitlePreservationResult {
	notesUpdated: number;
	errors: string[];
}

/**
 * Extract frontmatter from note content.
 */
function extractFrontmatter(content: string): { frontmatter: string; rest: string } | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return null;
	}
	return {
		frontmatter: match[1] ?? '',
		rest: content.slice(match[0].length),
	};
}

/**
 * Parse frontmatter into key-value pairs (simple parser, handles simple string values).
 */
function parseFrontmatter(frontmatter: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lines = frontmatter.split('\n');
	for (const line of lines) {
		const colonIndex = line.indexOf(':');
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();
			// Remove surrounding quotes
			const cleanedValue = value.replace(/^["']|["']$/g, '');
			result[key] = cleanedValue;
		}
	}
	return result;
}

/**
 * Serialize frontmatter key-value pairs back to YAML.
 */
function serializeFrontmatter(fm: Record<string, string>): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(fm)) {
		// Quote values that contain special characters
		const needsQuotes = /[:#{}[\]{}&*!|>'"%@`]/.test(value) || /^\s|\s$/.test(value);
		const quotedValue = needsQuotes ? `"${value}"` : value;
		lines.push(`${key}: ${quotedValue}`);
	}
	return lines.join('\n');
}

/**
 * Get the alias field name(s) to check. Obsidian uses "aliases" as an array,
 * but some users use "alias" as a single string.
 */
function getAliases(fm: Record<string, string>): string[] {
	const aliasesField = fm['aliases'] || fm['alias'];
	if (!aliasesField) {
		return [];
	}
	// Handle comma-separated or JSON array format
	if (aliasesField.startsWith('[') && aliasesField.endsWith(']')) {
		try {
			const parsed = JSON.parse(aliasesField) as unknown;
			return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
		} catch {
			return [aliasesField];
		}
	}
	return aliasesField.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Set the aliases field in frontmatter.
 */
function setAliases(fm: Record<string, string>, aliases: string[]): void {
	if (aliases.length === 0) {
		delete fm['aliases'];
		delete fm['alias'];
		return;
	}
	fm['aliases'] = JSON.stringify(aliases);
	delete fm['alias'];
}

/**
 * Add an original filename as an alias in the note's frontmatter.
 * Called when an attachment is renamed or moved to preserve the old name.
 */
export function addOriginalNameAsAlias(
	content: string,
	originalName: string,
): string {
	const fmResult = extractFrontmatter(content);
	if (!fmResult) {
		// No frontmatter, create one
		const newFrontmatter = `aliases:\n  - "${originalName}"\n---\n`;
		return `${newFrontmatter}${content}`;
	}

	const fm = parseFrontmatter(fmResult.frontmatter);
	const aliases = getAliases(fm);

	// Don't add duplicate
	if (aliases.includes(originalName)) {
		return content;
	}

	aliases.push(originalName);
	setAliases(fm, aliases);

	const newFrontmatter = serializeFrontmatter(fm);
	return `---\n${newFrontmatter}\n---\n${fmResult.rest}`;
}

/**
 * When an attachment is renamed from oldName to newName, update all notes that reference it
 * to add the old name as an alias in their frontmatter.
 */
export async function preserveOriginalNamesOnRename(
	app: App,
	oldAttachmentPath: string,
	newAttachmentPath: string,
): Promise<FrontmatterTitlePreservationResult> {
	const result: FrontmatterTitlePreservationResult = {
		notesUpdated: 0,
		errors: [],
	};

	const oldFileName = oldAttachmentPath.split('/').pop() ?? oldAttachmentPath;
	const newFileName = newAttachmentPath.split('/').pop() ?? newAttachmentPath;

	// Find all markdown files that reference the old attachment
	const markdownFiles = app.vault.getMarkdownFiles();

	for (const note of markdownFiles) {
		try {
			const content = await app.vault.read(note);

			// Check if the note references the old attachment path or filename
			const oldPathRegex = new RegExp(
				normalizePath(oldAttachmentPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
			);
			const oldNameRegex = new RegExp(
				oldFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
			);

			const referencesOldPath = oldPathRegex.test(content);
			const referencesOldName = oldNameRegex.test(content) &&
				!content.includes(newFileName);

			if (!referencesOldPath && !referencesOldName) {
				continue;
			}

			const updatedContent = addOriginalNameAsAlias(content, oldFileName);

			if (updatedContent !== content) {
				await app.vault.modify(note, updatedContent);
				result.notesUpdated++;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			result.errors.push(`${note.path}: ${msg}`);
		}
	}

	return result;
}

/**
 * Check if a note has an alias matching a given filename in its frontmatter.
 */
export function hasAliasForFilename(
	content: string,
	filename: string,
): boolean {
	const fmResult = extractFrontmatter(content);
	if (!fmResult) {
		return false;
	}
	const fm = parseFrontmatter(fmResult.frontmatter);
	const aliases = getAliases(fm);
	return aliases.includes(filename);
}
