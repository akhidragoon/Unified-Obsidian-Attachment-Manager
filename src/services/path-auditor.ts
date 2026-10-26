import { App } from 'obsidian';

export interface PathIssue {	type: 'broken_link' | 'missing_attachment' | 'misplaced' | 'unsafe_filename';
	filePath: string;
	link?: string;
	properPath?: string;
	reason: string;
	severity: 'low' | 'medium' | 'high';
}

export interface PathAuditReport {
	timestamp: number;
	totalFiles: number;
	totalAttachments: number;
	issues: PathIssue[];
	summary: {
		brokenLinks: number;
		missingAttachments: number;
		misplaced: number;
		unsafeFilenames: number;
	};
}

export function createPathIssue(
	type: PathIssue['type'],
	filePath: string,
	link: string,
	reason: string,
	severity: PathIssue['severity'] = 'medium',
	properPath?: string,
): PathIssue {
	return {
		type,
		filePath,
		link,
		reason,
		severity,
		properPath,
	};
}

export function createPathAuditReport(
	totalFiles: number,
	totalAttachments: number,
	issues: PathIssue[],
): PathAuditReport {
	const summary = {
		brokenLinks: issues.filter(i => i.type === 'broken_link').length,
		missingAttachments: issues.filter(i => i.type === 'missing_attachment').length,
		misplaced: issues.filter(i => i.type === 'misplaced').length,
		unsafeFilenames: issues.filter(i => i.type === 'unsafe_filename').length,
	};

	return {
		timestamp: Date.now(),
		totalFiles,
		totalAttachments,
		issues,
		summary,
	};
}

export function isAttachmentFilename(filename: string): boolean {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'avif'];
	const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'epub'];
	return [...imageExts, ...docExts].includes(ext);
}

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

export function isPathIgnored(path: string, settingsIgnorePatterns: string[]): boolean {
	for (const pattern of settingsIgnorePatterns) {
		const regex = new RegExp(pattern);
		if (regex.test(path)) return true;
	}
	return false;
}

export function hasUnsafeFilename(filename: string): boolean {
	const unsafePattern = /[<>:"/\\|?*]/;
	return unsafePattern.test(filename) || filename.length > 255 || /^\.+$/.test(filename);
}

export function generateAttachmentReport(report: PathAuditReport): string {
	const lines: string[] = [
		'# Attachment Audit Report',
		`Generated: ${new Date(report.timestamp).toISOString()}`,
		`Total Files: ${report.totalFiles}`,
		`Total Attachments: ${report.totalAttachments}`,
		'',
		'## Summary',
		`- Broken Links: ${report.summary.brokenLinks}`,
		`- Missing Attachments: ${report.summary.missingAttachments}`,
		`- Misplaced Attachments: ${report.summary.misplaced}`,
		`- Unsafe Filenames: ${report.summary.unsafeFilenames}`,
		'',
	];

	if (report.issues.length > 0) {
		lines.push('## Issues');
		for (const issue of report.issues) {
			lines.push(`### [${issue.severity.toUpperCase()}] ${issue.type.replace('_', ' ')}`);
			lines.push(`- File: ${issue.filePath}`);
			lines.push(`- Link: ${issue.link || 'N/A'}`);
			lines.push(`- Reason: ${issue.reason}`);
			if (issue.properPath) {
				lines.push(`- Proper Path: ${issue.properPath}`);
			}
			lines.push('');
		}
	} else {
		lines.push('## No issues found');
	}

	return lines.join('\n');
}
