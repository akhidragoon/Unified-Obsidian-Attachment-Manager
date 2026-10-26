/**
 * Link consistency checking beyond images.
 *
 * Scans all links in a note (markdown links, wiki links, embeds, frontmatter links)
 * and reports:
 * - Broken links: references that don't resolve to an existing file
 * - Misplaced attachments: attachments not in the proper folder for the note
 * - Frontmatter link issues
 */

import { App, Notice, TAbstractFile, TFile, normalizePath, TFolder } from 'obsidian';

export interface LinkConsistencyIssue {
	type: 'broken_link' | 'misplaced_attachment' | 'frontmatter_broken_link';
	notePath: string;
	linkText: string;
	resolvedPath?: string;
	properPath?: string;
	reason: string;
	severity: 'low' | 'medium' | 'high';
	line?: number;
}

export interface LinkConsistencyReport {
	timestamp: number;
	totalNotes: number;
	totalIssues: number;
	issues: LinkConsistencyIssue[];
	summary: {
		brokenLinks: number;
		misplacedAttachments: number;
		frontmatterBrokenLinks: number;
	};
}

export function createLinkConsistencyIssue(
	type: LinkConsistencyIssue['type'],
	notePath: string,
	linkText: string,
	reason: string,
	severity: LinkConsistencyIssue['severity'] = 'medium',
	resolvedPath?: string,
	properPath?: string,
	line?: number,
): LinkConsistencyIssue {
	return {
		type,
		notePath,
		linkText,
		reason,
		severity,
		resolvedPath,
		properPath,
		line,
	};
}

export function createLinkConsistencyReport(
	totalNotes: number,
	issues: LinkConsistencyIssue[],
): LinkConsistencyReport {
	const summary = {
		brokenLinks: issues.filter(i => i.type === 'broken_link').length,
		misplacedAttachments: issues.filter(i => i.type === 'misplaced_attachment').length,
		frontmatterBrokenLinks: issues.filter(i => i.type === 'frontmatter_broken_link').length,
	};

	return {
		timestamp: Date.now(),
		totalNotes,
		totalIssues: issues.length,
		issues,
		summary,
	};
}

/**
 * Get the proper attachment folder for a note.
 */
function getProperAttachmentFolder(app: App, notePath: string): string {
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
 * Check if a path is an attachment file (image, document, etc.)
 */
function isAttachmentFile(file: TAbstractFile): boolean {
	if (!(file instanceof TFile)) {
		return false;
	}
	const ext = file.extension.toLowerCase();
	const attachmentExtensions = [
		'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'avif',
		'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'epub',
		'mp3', 'mp4', 'wav', 'ogg', 'webm',
	];
	return attachmentExtensions.includes(ext);
}

/**
 * Check if a path is within a given folder.
 */
function isPathWithinFolder(filePath: string, folderPath: string): boolean {
	if (!folderPath) {
		return false;
	}
	const normalizedFolder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
	return filePath.startsWith(normalizedFolder);
}

/**
 * Check link consistency for all markdown notes in the vault.
 */
export async function checkLinkConsistency(
	app: App,
): Promise<LinkConsistencyReport> {
	const issues: LinkConsistencyIssue[] = [];
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		const noteIssues = await checkNoteLinkConsistency(app, file);
		issues.push(...noteIssues);
	}

	return createLinkConsistencyReport(files.length, issues);
}

/**
 * Check link consistency for a single note.
 */
async function checkNoteLinkConsistency(
	app: App,
	note: TFile,
): Promise<LinkConsistencyIssue[]> {
	const issues: LinkConsistencyIssue[] = [];

	// Get the metadata cache for this note
	const cache = app.metadataCache.getCache(note.path);
	if (!cache) {
		return issues;
	}

	const properFolder = getProperAttachmentFolder(app, note.path);

	// Check all links (wikilinks and markdown links)
	const links = cache.links ?? [];
	for (const link of links) {
		const issue = checkSingleLink(app, note, link, properFolder);
		if (issue) {
			issues.push(issue);
		}
	}

	// Check all embeds
	const embeds = cache.embeds ?? [];
	for (const embed of embeds) {
		const issue = checkSingleLink(app, note, embed, properFolder, true);
		if (issue) {
			issues.push(issue);
		}
	}

	// Check frontmatter links
	const frontmatterLinks = cache.frontmatterLinks ?? [];
	for (const fmLink of frontmatterLinks) {
		const issue = checkFrontmatterLink(app, note, fmLink, properFolder);
		if (issue) {
			issues.push(issue);
		}
	}

	return issues;
}

/**
 * Check a single link or embed reference.
 */
function checkSingleLink(
	app: App,
	note: TFile,
	link: { link: string; position?: { start: { line: number } } },
	properFolder: string,
	isEmbed: boolean = false,
): LinkConsistencyIssue | null {
	const linkText = link.link;
	if (!linkText || linkText.startsWith('http') || linkText.startsWith('#')) {
		return null;
	}

	// Resolve the link target
	const linkPath = normalizePath(linkText);
	let resolvedPath: string | null = null;

	// Try relative to note folder first
	const noteDir = note.path.substring(0, note.path.lastIndexOf('/'));
	const relativePath = normalizePath(`${noteDir}/${linkPath}`);
	const relativeFile = app.vault.getAbstractFileByPath(relativePath);
	if (relativeFile) {
		resolvedPath = relativeFile.path;
	} else {
		// Try as-is from vault root
		const rootFile = app.vault.getAbstractFileByPath(linkPath);
		if (rootFile) {
			resolvedPath = rootFile.path;
		}
	}

	if (!resolvedPath) {
		return createLinkConsistencyIssue(
			'broken_link',
			note.path,
			linkText,
			'Reference does not resolve to an existing file',
			'high',
			undefined,
			undefined,
			link.position?.start.line,
		);
	}

	const resolvedFile = app.vault.getAbstractFileByPath(resolvedPath);

	// If it's an attachment, check if it's in the proper folder
	if (resolvedFile instanceof TFile && isAttachmentFile(resolvedFile)) {
		if (properFolder && !isPathWithinFolder(resolvedPath, properFolder)) {
			const fileName = resolvedFile.name;
			return createLinkConsistencyIssue(
				'misplaced_attachment',
				note.path,
				linkText,
				'Attachment not in proper folder for this note',
				'medium',
				resolvedPath,
				`${properFolder}/${fileName}`,
				link.position?.start.line,
			);
		}
	}

	return null;
}

/**
 * Check a frontmatter link reference.
 */
function checkFrontmatterLink(
	app: App,
	note: TFile,
	link: { key: string; link: string },
	properFolder: string,
): LinkConsistencyIssue | null {
	const linkText = link.link;
	if (!linkText || linkText.startsWith('http') || linkText.startsWith('#')) {
		return null;
	}

	const linkPath = normalizePath(linkText);
	let resolvedPath: string | null = null;

	const noteDir = note.path.substring(0, note.path.lastIndexOf('/'));
	const relativePath = normalizePath(`${noteDir}/${linkPath}`);
	const relativeFile = app.vault.getAbstractFileByPath(relativePath);
	if (relativeFile) {
		resolvedPath = relativeFile.path;
	} else {
		const rootFile = app.vault.getAbstractFileByPath(linkPath);
		if (rootFile) {
			resolvedPath = rootFile.path;
		}
	}

	if (!resolvedPath) {
		return createLinkConsistencyIssue(
			'frontmatter_broken_link',
			note.path,
			linkText,
			`Frontmatter field "${link.key}" references a non-existent file`,
			'high',
		);
	}

	const resolvedFile = app.vault.getAbstractFileByPath(resolvedPath);

	if (resolvedFile instanceof TFile && isAttachmentFile(resolvedFile)) {
		if (properFolder && !isPathWithinFolder(resolvedPath, properFolder)) {
			const fileName = resolvedFile.name;
			return createLinkConsistencyIssue(
				'misplaced_attachment',
				note.path,
				linkText,
				'Frontmatter attachment not in proper folder for this note',
				'medium',
				resolvedPath,
				`${properFolder}/${fileName}`,
			);
		}
	}

	return null;
}

/**
 * Generate a text report from the consistency check results.
 */
export function generateLinkConsistencyReportText(
	report: LinkConsistencyReport,
): string {
	const lines: string[] = [
		'# Link Consistency Report',
		`Generated: ${new Date(report.timestamp).toISOString()}`,
		`Total Notes: ${report.totalNotes}`,
		`Total Issues: ${report.totalIssues}`,
		'',
		'## Summary',
		`- Broken Links: ${report.summary.brokenLinks}`,
		`- Misplaced Attachments: ${report.summary.misplacedAttachments}`,
		`- Frontmatter Broken Links: ${report.summary.frontmatterBrokenLinks}`,
		'',
	];

	if (report.issues.length > 0) {
		lines.push('## Issues');
		for (const issue of report.issues) {
			lines.push(`### [${issue.severity.toUpperCase()}] ${issue.type.replace('_', ' ')}`);
			lines.push(`- Note: ${issue.notePath}`);
			lines.push(`- Link: ${issue.linkText}`);
			lines.push(`- Reason: ${issue.reason}`);
			if (issue.resolvedPath) {
				lines.push(`- Resolved: ${issue.resolvedPath}`);
			}
			if (issue.properPath) {
				lines.push(`- Should be: ${issue.properPath}`);
			}
			if (issue.line !== undefined) {
				lines.push(`- Line: ${issue.line + 1}`);
			}
			lines.push('');
		}
	} else {
		lines.push('## No issues found');
	}

	return lines.join('\n');
}

/**
 * Check link consistency across all markdown notes in the vault.
 */
export async function auditAttachmentLinks(app: App): Promise<void> {
	const files = app.vault.getMarkdownFiles();
	const issues: LinkConsistencyIssue[] = [];
	let totalAttachments = 0;

	for (const file of files) {
		const content = await app.vault.read(file);
		const cache = app.metadataCache.getCache(file.path);
		if (!cache) continue;

		const properFolder = getProperAttachmentFolder(app, file.path);

		const links = cache.links ?? [];
		for (const link of links) {
			const issue = checkSingleLink(app, file, link, properFolder);
			if (issue) {
				issues.push(issue);
				if (issue.type === 'misplaced_attachment') totalAttachments++;
				else totalAttachments++;
			}
		}

		const embeds = cache.embeds ?? [];
		for (const embed of embeds) {
			const issue = checkSingleLink(app, file, embed, properFolder, true);
			if (issue) {
				issues.push(issue);
				totalAttachments++;
			}
		}
	}

	const report = createLinkConsistencyReport(files.length, issues);
	const reportText = generateLinkConsistencyReportText(report);

	new Notice(`Audit complete: ${report.summary.brokenLinks} broken links, ${report.summary.misplacedAttachments} misplaced`);
	new Notice(reportText.substring(0, 200) + '...');
}
