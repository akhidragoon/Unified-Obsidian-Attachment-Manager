export interface AttachmentPolicy {
	attachmentFolder: string;
	alwaysUseSubfolder: boolean;
	enabled: boolean;
}

export interface MoveResult {
	success: boolean;
	newPath?: string;
	error?: string;
}

export interface CreateFolderResult {
	success: boolean;
	folderPath?: string;
	error?: string;
}

export function getEffectiveAttachmentFolder(
	notePath: string,
	policy: AttachmentPolicy,
): string {
	const noteDir = notePath.substring(0, notePath.lastIndexOf('/'));

	if (policy.alwaysUseSubfolder && policy.attachmentFolder) {
		return noteDir ? `${noteDir}/${policy.attachmentFolder}` : policy.attachmentFolder;
	}

	return noteDir || '';
}

export function ensureAttachmentSubfolder(
	notePath: string,
	policy: AttachmentPolicy,
): CreateFolderResult {
	if (!policy.alwaysUseSubfolder || !policy.attachmentFolder) {
		return { success: true, folderPath: getEffectiveAttachmentFolder(notePath, policy) };
	}

	const folder = getEffectiveAttachmentFolder(notePath, policy);
	return { success: true, folderPath: folder };
}

export function getTargetAttachmentPath(
	notePath: string,
	attachmentName: string,
	policy: AttachmentPolicy,
): string {
	const folder = getEffectiveAttachmentFolder(notePath, policy);
	return folder ? `${folder}/${attachmentName}` : attachmentName;
}

export function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
		.replace(/^\.+/, '')
		.replace(/\.+$/, '')
		.replace(/_{2,}/g, '_')
		.trim() || 'unnamed';
}

export function generateUniqueFilename(
	baseName: string,
	existingPaths: Set<string>,
): string {
	if (!existingPaths.has(baseName)) {
		return baseName;
	}

	const lastDot = baseName.lastIndexOf('.');
	let name: string;
	let ext: string;

	if (lastDot > 0) {
		name = baseName.substring(0, lastDot);
		ext = baseName.substring(lastDot);
	} else {
		name = baseName;
		ext = '';
	}

	let counter = 1;
	let candidate: string;
	do {
		candidate = `${name}_${counter}${ext}`;
		counter++;
	} while (existingPaths.has(candidate));

	return candidate;
}

export function generateUniquePath(
	targetPath: string,
	existingPaths: Set<string>,
): string {
	return generateUniqueFilename(targetPath, existingPaths);
}

export function isAttachmentPath(path: string, policy: AttachmentPolicy): boolean {
	const normalized = path.toLowerCase();
	const folder = policy.attachmentFolder.toLowerCase();
	return normalized.includes(`/${folder}/`) || normalized.startsWith(`${folder}/`);
}

export function resolveAttachmentPath(
	attachmentName: string,
	notePath: string,
	policy: AttachmentPolicy,
): string {
	return getTargetAttachmentPath(notePath, attachmentName, policy);
}

export function moveAttachment(
	sourcePath: string,
	targetPath: string,
	existingPaths: Set<string>,
): MoveResult {
	if (sourcePath === targetPath) {
		return { success: true, newPath: targetPath };
	}

	const finalPath = generateUniquePath(targetPath, existingPaths);
	return {
		success: true,
		newPath: finalPath,
	};
}

export function renameAttachment(
	oldPath: string,
	newName: string,
	existingPaths: Set<string>,
): MoveResult {
	const lastSlash = oldPath.lastIndexOf('/');
	const dir = lastSlash > 0 ? oldPath.substring(0, lastSlash + 1) : '';
	const newPath = `${dir}${newName}`;

	if (oldPath === newPath) {
		return { success: true, newPath };
	}

	const finalPath = generateUniquePath(newPath, existingPaths);
	return {
		success: true,
		newPath: finalPath,
	};
}

export function createDefaultPolicy(): AttachmentPolicy {
	return {
		attachmentFolder: 'attachments',
		alwaysUseSubfolder: false,
		enabled: true,
	};
}

export function getObsidianDefaultPolicy(): AttachmentPolicy {
	return {
		attachmentFolder: 'attachments',
		alwaysUseSubfolder: true,
		enabled: true,
	};
}