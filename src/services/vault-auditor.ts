import { ReferenceSpan, ReferenceType } from '../core/path-resolver';
import { scanReferences } from '../core/reference-scanner';

export interface AuditIssue {
	type: 'broken_link' | 'missing_attachment' | 'orphaned' | 'duplicate' | 'unsafe_filename' | 'wrong_location';
	filePath: string;
	line?: number;
	link?: string;
	reason: string;
	severity: 'low' | 'medium' | 'high';
	suggestedFix?: string;
}

export interface AuditReport {
	timestamp: number;
	totalFiles: number;
	totalAttachments: number;
	issues: AuditIssue[];
	summary: {
		brokenLinks: number;
		missingAttachments: number;
		orphaned: number;
		duplicates: number;
		unsafeFilenames: number;
		wrongLocations: number;
	};
}

export interface AuditOptions {
	includeOrphaned?: boolean;
	includeDuplicates?: boolean;
	checkFilenames?: boolean;
	checkLocations?: boolean;
}

export function createAuditIssue(
	type: AuditIssue['type'],
	filePath: string,
	link: string,
	reason: string,
	severity: AuditIssue['severity'] = 'medium',
	suggestedFix?: string,
): AuditIssue {
	return {
		type,
		filePath,
		link,
		reason,
		severity,
		suggestedFix,
	};
}

export function createAuditReport(
	totalFiles: number,
	totalAttachments: number,
	issues: AuditIssue[],
): AuditReport {
	const summary = {
		brokenLinks: issues.filter(i => i.type === 'broken_link').length,
		missingAttachments: issues.filter(i => i.type === 'missing_attachment').length,
		orphaned: issues.filter(i => i.type === 'orphaned').length,
		duplicates: issues.filter(i => i.type === 'duplicate').length,
		unsafeFilenames: issues.filter(i => i.type === 'unsafe_filename').length,
		wrongLocations: issues.filter(i => i.type === 'wrong_location').length,
	};

	return {
		timestamp: Date.now(),
		totalFiles,
		totalAttachments,
		issues,
		summary,
	};
}

export function detectBrokenLinks(
	references: ReferenceSpan[],
	existingFiles: Set<string>,
): AuditIssue[] {
	const issues: AuditIssue[] = [];

	for (const ref of references) {
		if (ref.type === ReferenceType.InternalLink || 
			ref.type === ReferenceType.InternalImage ||
			ref.type === ReferenceType.InternalWikilink ||
			ref.type === ReferenceType.InternalWikiImage ||
			ref.type === ReferenceType.HtmlImage) {
			
			if (!existingFiles.has(ref.link) && !ref.link.includes('://')) {
				issues.push(createAuditIssue(
					'broken_link',
					'',
					ref.link,
					'Referenced file does not exist',
					'high',
					'Check the link path or create the missing file',
				));
			}
		}
	}

	return issues;
}

export function detectMissingAttachments(
	references: ReferenceSpan[],
	existingAttachments: Set<string>,
	filePath: string,
): AuditIssue[] {
	const issues: AuditIssue[] = [];

	for (const ref of references) {
		if (ref.type === ReferenceType.InternalImage || 
			ref.type === ReferenceType.InternalWikiImage ||
			ref.type === ReferenceType.HtmlImage) {
			
			if (!existingAttachments.has(ref.link)) {
				issues.push(createAuditIssue(
					'missing_attachment',
					filePath,
					ref.link,
					'Attachment file is missing',
					'high',
					'Download the image or remove the reference',
				));
			}
		}
	}

	return issues;
}

export function detectUnsafeFilenames(filenames: string[]): AuditIssue[] {
	const issues: AuditIssue[] = [];
	const unsafePattern = /[<>:"/\\|?*]/;

	for (const filename of filenames) {
		if (unsafePattern.test(filename)) {
			issues.push(createAuditIssue(
				'unsafe_filename',
				'',
				filename,
				'Filename contains unsafe characters',
				'medium',
				'Rename file using only safe characters',
			));
		}
		if (filename.length > 255) {
			issues.push(createAuditIssue(
				'unsafe_filename',
				'',
				filename,
				'Filename is too long',
				'medium',
				'Shorten the filename',
			));
		}
		if (/^\.+$/.test(filename)) {
			issues.push(createAuditIssue(
				'unsafe_filename',
				'',
				filename,
				'Filename is only dots',
				'medium',
				'Provide a proper filename',
			));
		}
	}

	return issues;
}

export function detectOrphanedAttachments(
	allAttachments: Set<string>,
	referencedAttachments: Set<string>,
): AuditIssue[] {
	const issues: AuditIssue[] = [];
	const orphaned = Array.from(allAttachments).filter(a => !referencedAttachments.has(a));

	for (const attachment of orphaned) {
		issues.push(createAuditIssue(
			'orphaned',
			'',
			attachment,
			'Attachment not referenced by any note',
			'low',
			'Consider removing if no longer needed',
		));
	}

	return issues;
}

export function detectDuplicates(attachments: string[]): AuditIssue[] {
	const issues: AuditIssue[] = [];
	const seen = new Map<string, string[]>();

	for (const att of attachments) {
		const key = att.toLowerCase();
		if (!seen.has(key)) {
			seen.set(key, []);
		}
		seen.get(key)!.push(att);
	}

	for (const [key, files] of seen) {
		if (files.length > 1) {
			issues.push(createAuditIssue(
				'duplicate',
				'',
				key,
				`Duplicate files found: ${files.join(', ')}`,
				'medium',
				'Remove duplicate files and update references',
			));
		}
	}

	return issues;
}

export function auditNote(content: string, filePath: string, existingFiles: Set<string>): AuditIssue[] {
	const issues: AuditIssue[] = [];
	const scan = scanReferences(content);

	const broken = detectBrokenLinks(scan.references, existingFiles);
	broken.forEach(b => b.filePath = filePath);
	issues.push(...broken);

	return issues;
}

export function generateAuditReportText(report: AuditReport): string {
	const lines: string[] = [
		'# Attachment Audit Report',
		`Generated: ${new Date(report.timestamp).toISOString()}`,
		`Total Files: ${report.totalFiles}`,
		`Total Attachments: ${report.totalAttachments}`,
		'',
		'## Summary',
		`- Broken Links: ${report.summary.brokenLinks}`,
		`- Missing Attachments: ${report.summary.missingAttachments}`,
		`- Orphaned Attachments: ${report.summary.orphaned}`,
		`- Duplicates: ${report.summary.duplicates}`,
		`- Unsafe Filenames: ${report.summary.unsafeFilenames}`,
		`- Wrong Locations: ${report.summary.wrongLocations}`,
		'',
	];

	if (report.issues.length > 0) {
		lines.push('## Issues');
		for (const issue of report.issues) {
			lines.push(`### [${issue.severity.toUpperCase()}] ${issue.type.replace('_', ' ')}`);
			lines.push(`- File: ${issue.filePath || 'N/A'}`);
			lines.push(`- Link: ${issue.link || 'N/A'}`);
			lines.push(`- Reason: ${issue.reason}`);
			if (issue.suggestedFix) {
				lines.push(`- Suggested Fix: ${issue.suggestedFix}`);
			}
			lines.push('');
		}
	} else {
		lines.push('## No issues found');
	}

	return lines.join('\n');
}

export function filterIssuesBySeverity(issues: AuditIssue[], severity: AuditIssue['severity']): AuditIssue[] {
	return issues.filter(i => i.severity === severity);
}

export function filterIssuesByType(issues: AuditIssue[], type: AuditIssue['type']): AuditIssue[] {
	return issues.filter(i => i.type === type);
}
