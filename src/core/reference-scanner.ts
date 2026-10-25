import { isExternalUrl, ReferenceType, ReferenceSpan } from './path-resolver';

export { ReferenceType };
export type { ReferenceSpan };

export interface ScanResult {
	references: ReferenceSpan[];
	externalUrls: string[];
}

const markdownImageRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const markdownLinkRe = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const wikiEmbedRe = /!\[\[([^\]]+)\]\]/g;
const wikiLinkRe = /(?<!!)\[\[([^\]]+)\]\]/g;
const htmlImageRe = /<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi;

export function scanReferences(content: string): ScanResult {
	const references: ReferenceSpan[] = [];
	const externalUrls: string[] = [];

	const processExternalUrl = (url: string, start: number, end: number) => {
		references.push({ type: ReferenceType.ExternalUrl, link: url, start, end });
		externalUrls.push(url);
	};

	const processInternalUrl = (type: ReferenceType, url: string, start: number, end: number) => {
		references.push({ type, link: url, start, end });
	};

	let match: RegExpExecArray | null;
	const mdImage = markdownImageRe;
	while ((match = mdImage.exec(content)) !== null) {
		const url = match[2] ?? '';
		if (!url) continue;
		const start = match.index;
		const end = mdImage.lastIndex;
		if (isExternalUrl(url)) {
			references.push({ type: ReferenceType.ExternalImage, link: url, start, end });
			externalUrls.push(url);
		} else {
			references.push({ type: ReferenceType.InternalImage, link: url, start, end });
		}
	}
	mdImage.lastIndex = 0;

	const mdLink = markdownLinkRe;
	while ((match = mdLink.exec(content)) !== null) {
		const url = match[2] ?? '';
		if (!url) continue;
		const start = match.index;
		const end = mdLink.lastIndex;
		if (isExternalUrl(url)) {
			processExternalUrl(url, start, end);
		} else {
			processInternalUrl(ReferenceType.InternalLink, url, start, end);
		}
	}
	mdLink.lastIndex = 0;

	const wikiEmbed = wikiEmbedRe;
	while ((match = wikiEmbed.exec(content)) !== null) {
		const url = match[1] ?? '';
		if (!url) continue;
		const start = match.index;
		const end = wikiEmbed.lastIndex;
		if (isExternalUrl(url)) {
			references.push({ type: ReferenceType.ExternalImage, link: url, start, end });
			externalUrls.push(url);
		} else {
			references.push({ type: ReferenceType.InternalWikiImage, link: url, start, end });
		}
	}
	wikiEmbed.lastIndex = 0;

	const wikiLink = wikiLinkRe;
	while ((match = wikiLink.exec(content)) !== null) {
		const url = match[1] ?? '';
		if (!url) continue;
		const start = match.index;
		const end = wikiLink.lastIndex;
		if (isExternalUrl(url)) {
			processExternalUrl(url, start, end);
		} else {
			references.push({ type: ReferenceType.InternalWikilink, link: url, start, end });
		}
	}
	wikiLink.lastIndex = 0;

	const htmlImg = htmlImageRe;
	while ((match = htmlImg.exec(content)) !== null) {
		const url = match[1] ?? '';
		if (!url) continue;
		const start = match.index;
		const end = htmlImg.lastIndex;
		if (isExternalUrl(url)) {
			references.push({ type: ReferenceType.ExternalImage, link: url, start, end });
			externalUrls.push(url);
		} else {
			references.push({ type: ReferenceType.HtmlImage, link: url, start, end });
		}
	}
	htmlImg.lastIndex = 0;

	const frontmatterRe = /^---\s*\r?\n([\s\S]*?)\r?\n---/;
	const fmMatch = frontmatterRe.exec(content);
	if (fmMatch) {
		const frontmatter = fmMatch[1] ?? '';
		const fmStart = fmMatch.index + 4;
		const fmLines = frontmatter.split('\n');
		let lineOffset = fmStart;
		for (const line of fmLines) {
			const keyMatch = /^([a-zA-Z_-]+):\s*(https?:\/\/\S+)/.exec(line);
			if (keyMatch && keyMatch[2]) {
				const url = keyMatch[2];
				const start = lineOffset + keyMatch.index;
				const end = lineOffset + keyMatch[0].length;
				references.push({ type: ReferenceType.Frontmatter, link: url, start, end });
				externalUrls.push(url);
			}
			lineOffset += line.length + 1;
		}
	}

	return { references, externalUrls };
}

export function getExternalImageUrls(content: string): string[] {
	const scan = scanReferences(content);
	return Array.from(new Set(scan.externalUrls));
}

export function isCodeBlock(content: string, position: number): boolean {
	const lines = content.split('\n');
	let charCount = 0;
	let inCodeBlock = false;

	for (const line of lines) {
		const lineEnd = charCount + line.length;
		if (position >= charCount && position <= lineEnd) {
			return inCodeBlock;
		}
		if (line.trim().startsWith('```')) {
			inCodeBlock = !inCodeBlock;
		}
		charCount = lineEnd + 1;
	}

	return inCodeBlock;
}

export function isInlineCode(content: string, position: number): boolean {
	const lineStart = content.lastIndexOf('\n', position - 1) + 1;
	const lineEnd = content.indexOf('\n', position);
	const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

	const backtickIndices: number[] = [];
	for (let i = 0; i < line.length; i++) {
		if (line[i] === '`') {
			backtickIndices.push(i);
		}
	}

	if (backtickIndices.length < 2) return false;

	const localPos = position - lineStart;
	for (let i = 0; i < backtickIndices.length - 1; i += 2) {
		const start = backtickIndices[i];
		const end = backtickIndices[i + 1];
		if (start !== undefined && end !== undefined && localPos > start && localPos < end) {
			return true;
		}
	}

	return false;
}

export function isCodeOrInlineCode(content: string, position: number): boolean {
	return isCodeBlock(content, position) || isInlineCode(content, position);
}

export function filterOutCodeBlockReferences(
	references: Array<ReferenceSpan>,
	content: string,
): Array<ReferenceSpan> {
	return references.filter((ref) => !isCodeOrInlineCode(content, ref.start));
}

export function deduplicateUrls(urls: string[]): string[] {
	return Array.from(new Set(urls));
}

export function getUniqueExternalUrls(references: Array<ReferenceSpan>): string[] {
	return Array.from(new Set(references
		.filter((r) => isExternalUrl(r.link))
		.map((r) => r.link)));
}
