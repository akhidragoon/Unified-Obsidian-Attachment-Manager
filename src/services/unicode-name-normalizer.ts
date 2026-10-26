/**
 * Unicode Name Normalization.
 *
 * Detects filenames stored on disk in a form other than Unicode NFC (e.g. from old macOS volumes,
 * archives, or other tools) and renames them to NFC. Sync, git, and backup tools see the two forms
 * as different names, so normalizing prevents sync conflicts.
 *
 * Obsidian keys its file index by NFC path, so `file.path` is always NFC; only the on-disk
 * `realpath` can differ. Renaming within the vault API handles most cases.
 */

import { App, TAbstractFile } from 'obsidian';

export enum UnicodeNormalizationOutcome {
	Collision = 'Collision',
	Normalized = 'Normalized',
	NotNeeded = 'NotNeeded',
}

const TEMPORARY_NAME_SUFFIX = '.nfc-tmp';

export function isUnicodeNormalized(name: string): boolean {
	return name === name.normalize('NFC');
}

export function getName(path: string): string {
	const slashIndex = path.lastIndexOf('/');
	return slashIndex === -1 ? path : path.slice(slashIndex + 1);
}

export function getParentPath(path: string): string {
	const slashIndex = path.lastIndexOf('/');
	return slashIndex === -1 ? '' : path.slice(0, slashIndex);
}

export function joinPath(parentPath: string, name: string): string {
	return parentPath === '' ? name : `${parentPath}/${name}`;
}

/**
 * Check if a file or folder's name is NFC normalized on disk.
 */
export function isFileNameNormalized(app: App, file: TAbstractFile): boolean {
	const adapter = (app.vault as unknown as { adapter?: { files?: Record<string, { realpath?: string }> } })
		.adapter;
	const realPath = adapter?.files?.[file.path]?.realpath ?? file.path;
	const realName = getName(realPath);
	return isUnicodeNormalized(realName);
}

/**
 * Scan all files and folders for non-NFC names.
 */
export function scanNonNormalizedFiles(app: App): TAbstractFile[] {
	const nonNormalized: TAbstractFile[] = [];
	for (const file of app.vault.getAllLoadedFiles()) {
		if (!isFileNameNormalized(app, file)) {
			nonNormalized.push(file);
		}
	}
	return nonNormalized;
}

/**
 * Normalize a single file's on-disk name to NFC.
 * Uses vault.rename with a temporary name to handle case-insensitive filesystems.
 */
export async function normalizeFileName(
	app: App,
	file: TAbstractFile,
): Promise<UnicodeNormalizationOutcome> {
	if (isFileNameNormalized(app, file)) {
		return UnicodeNormalizationOutcome.NotNeeded;
	}

	const realName = getName(file.path);
	const normalizedName = realName.normalize('NFC');

	if (normalizedName === realName) {
		return UnicodeNormalizationOutcome.NotNeeded;
	}

	const parentPath = getParentPath(file.path);
	const temporaryName = `${normalizedName}${TEMPORARY_NAME_SUFFIX}`;
	const temporaryPath = joinPath(parentPath, temporaryName);
	const normalizedPath = joinPath(parentPath, normalizedName);

	try {
		// First rename to temporary name
		await app.vault.rename(file, temporaryPath);
		// Then rename to normalized name
		await app.vault.rename(
			app.vault.getAbstractFileByPath(temporaryPath) as TAbstractFile,
			normalizedPath,
		);
		return UnicodeNormalizationOutcome.Normalized;
	} catch {
		// If temporary name collides, try with additional suffix
		let attempt = 1;
		let attemptName = `${normalizedName}${TEMPORARY_NAME_SUFFIX}.${attempt}`;
		let attemptPath = joinPath(parentPath, attemptName);

		while (app.vault.getAbstractFileByPath(attemptPath)) {
			attempt++;
			attemptName = `${normalizedName}${TEMPORARY_NAME_SUFFIX}.${attempt}`;
			attemptPath = joinPath(parentPath, attemptName);
		}

		try {
			await app.vault.rename(file, attemptPath);
			await app.vault.rename(
				app.vault.getAbstractFileByPath(attemptPath) as TAbstractFile,
				normalizedPath,
			);
			return UnicodeNormalizationOutcome.Normalized;
		} catch {
			return UnicodeNormalizationOutcome.Collision;
		}
	}
}

/**
 * Normalize all non-NFC filenames in the vault.
 */
export async function normalizeAllFileNames(
	app: App,
): Promise<{ normalized: number; notNeeded: number; collisions: number; errors: string[] }> {
	const result = { normalized: 0, notNeeded: 0, collisions: 0, errors: [] as string[] };
	const files = scanNonNormalizedFiles(app);

	for (const file of files) {
		try {
			const outcome = await normalizeFileName(app, file);
			switch (outcome) {
				case UnicodeNormalizationOutcome.Normalized:
					result.normalized++;
					break;
				case UnicodeNormalizationOutcome.NotNeeded:
					result.notNeeded++;
					break;
				case UnicodeNormalizationOutcome.Collision:
					result.collisions++;
					break;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			result.errors.push(`${file.path}: ${msg}`);
		}
	}

	return result;
}
