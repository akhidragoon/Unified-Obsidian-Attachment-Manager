import { ReferenceSpan, ReferenceType } from '../core/path-resolver';
import { scanReferences } from '../core/reference-scanner';
import { applyReferenceEdits, EditResult } from '../core/safe-markdown-editor';

export interface OrganizationPolicy {
	type: 'central' | 'note-specific' | 'custom';
	centralFolder: string;
	noteSubfolder: string;
	preserveStructure: boolean;
	createSubfolders: boolean;
}

export interface MovePlan {
	sourcePath: string;
	targetPath: string;
	references: ReferenceSpan[];
	notePaths: string[];
}

export interface OrganizationResult {
	moved: number;
	updated: number;
	failed: number;
	errors: string[];
}

export function createDefaultOrganizationPolicy(): OrganizationPolicy {
	return {
		type: 'note-specific',
		centralFolder: 'Attachments',
		noteSubfolder: 'attachments',
		preserveStructure: true,
		createSubfolders: true,
	};
}

export function getTargetFolder(
	notePath: string,
	policy: OrganizationPolicy,
): string {
	if (policy.type === 'central') {
		return policy.centralFolder;
	}
	if (policy.type === 'note-specific') {
		const noteDir = notePath.substring(0, notePath.lastIndexOf('/'));
		return noteDir ? `${noteDir}/${policy.noteSubfolder}` : policy.noteSubfolder;
	}
	return policy.centralFolder;
}

export function getTargetPath(
	notePath: string,
	attachmentName: string,
	policy: OrganizationPolicy,
): string {
	const folder = getTargetFolder(notePath, policy);
	return folder ? `${folder}/${attachmentName}` : attachmentName;
}

export function shouldMoveAttachment(
	currentPath: string,
	targetPath: string,
): boolean {
	return currentPath !== targetPath;
}

export function findReferencesToAttachment(
	content: string,
	attachmentName: string,
): ReferenceSpan[] {
	const scan = scanReferences(content);
	return scan.references.filter(ref => 
		ref.link === attachmentName || 
		ref.link.endsWith(`/${attachmentName}`) ||
		ref.link.split('/').pop() === attachmentName
	);
}

export function updateReferencesInContent(
	content: string,
	oldPath: string,
	newPath: string,
	references: ReferenceSpan[],
): EditResult {
	const mapping = new Map<string, string>();
	for (const ref of references) {
		if (ref.link.includes(oldPath.split('/').pop() || oldPath)) {
			const basename = oldPath.split('/').pop() || oldPath;
			if (ref.link === basename || ref.link.endsWith('/' + basename)) {
				mapping.set(ref.link, newPath.split('/').pop() || newPath);
			}
		}
	}
	return applyReferenceEdits(content, references, mapping);
}

export function createMovePlan(
	attachmentPath: string,
	notePath: string,
	policy: OrganizationPolicy,
	references: ReferenceSpan[],
): MovePlan {
	const basename = attachmentPath.split('/').pop() || attachmentPath;
	const targetPath = getTargetPath(notePath, basename, policy);
	
	return {
		sourcePath: attachmentPath,
		targetPath,
		references,
		notePaths: [notePath],
	};
}

export function generateOrganizationReport(plans: MovePlan[]): string {
	const lines: string[] = [
		'# Attachment Organization Report',
		`Operations: ${plans.length}`,
		'',
	];

	for (const plan of plans) {
		lines.push(`## ${plan.sourcePath} → ${plan.targetPath}`);
		lines.push(`- References to update: ${plan.references.length}`);
		lines.push(`- Notes affected: ${plan.notePaths.length}`);
		lines.push('');
	}

	return lines.join('\n');
}

export function validateMovePlan(plan: MovePlan): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!plan.sourcePath) {
		errors.push('Source path is required');
	}
	if (!plan.targetPath) {
		errors.push('Target path is required');
	}
	if (plan.sourcePath === plan.targetPath) {
		errors.push('Source and target paths are the same');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

export function applyOrganizationPolicy(
	attachmentPath: string,
	notePath: string,
	policy: OrganizationPolicy,
): string {
	const basename = attachmentPath.split('/').pop() || attachmentPath;
	return getTargetPath(notePath, basename, policy);
}
