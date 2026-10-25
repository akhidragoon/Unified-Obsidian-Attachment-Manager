import { ReferenceSpan, ReferenceType } from './path-resolver';
import { isCodeOrInlineCode } from './reference-scanner';

export { ReferenceType, isCodeOrInlineCode };
export type { ReferenceSpan };

export interface EditResult {
	content: string;
	changed: boolean;
}

export interface Edit {
	start: number;
	end: number;
	replacement: string;
}

export function applyEdits(content: string, edits: Edit[]): EditResult {
	if (edits.length === 0) {
		return { content, changed: false };
	}

	const sorted = [...edits].sort((a, b) => a.start - b.start);
	let result = '';
	let lastEnd = 0;

	for (const edit of sorted) {
		if (edit.start < lastEnd) {
			continue;
		}
		result += content.slice(lastEnd, edit.start);
		result += edit.replacement;
		lastEnd = edit.end;
	}

	result += content.slice(lastEnd);

	return {
		content: result,
		changed: result !== content,
	};
}

export function applyReferenceEdits(
	content: string,
	references: Array<ReferenceSpan>,
	mapping: Map<string, string>,
): EditResult {
	const edits: Edit[] = [];

	for (const ref of references) {
		const newLink = mapping.get(ref.link);
		if (newLink === undefined || newLink === ref.link) {
			continue;
		}

		if (isCodeOrInlineCode(content, ref.start)) {
			continue;
		}

		let replacement = newLink;
		// Preserve surrounding syntax based on reference type
		switch (ref.type) {
			case ReferenceType.InternalWikiImage:
				replacement = `![[${newLink}]]`;
				break;
			case ReferenceType.InternalWikilink:
				replacement = `[[${newLink}]]`;
				break;
			case ReferenceType.InternalImage:
				replacement = `![alt](${newLink})`; // We don't have alt text, use generic
				break;
			case ReferenceType.InternalLink:
				replacement = `[link](${newLink})`;
				break;
			case ReferenceType.HtmlImage:
				replacement = `<img src="${newLink}" alt="image">`;
				break;
			case ReferenceType.Frontmatter:
				replacement = newLink;
				break;
			default:
				replacement = newLink;
		}

		edits.push({
			start: ref.start,
			end: ref.end,
			replacement,
		});
	}

	return applyEdits(content, edits);
}

export function replaceLinkTarget(content: string, oldLink: string, newLink: string): EditResult {
	const edits: Edit[] = [];
	const escaped = oldLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`\\[([^\\]]*)\\]\\(${escaped}\\)`, 'g');
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		if (isCodeOrInlineCode(content, match.index)) {
			continue;
		}
		edits.push({
			start: match.index,
			end: re.lastIndex,
			replacement: `[${match[1]}](${newLink})`,
		});
	}
	return applyEdits(content, edits);
}

export function replaceWikiLinkTarget(content: string, oldLink: string, newLink: string): EditResult {
	const edits: Edit[] = [];
	const escaped = oldLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`!\\[\\[(${escaped})\\]\\]`, 'g');
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		if (isCodeOrInlineCode(content, match.index)) {
			continue;
		}
		edits.push({
			start: match.index,
			end: re.lastIndex,
			replacement: `![[${newLink}]]`,
		});
	}
	return applyEdits(content, edits);
}

export function replaceHtmlImageSrc(content: string, oldSrc: string, newSrc: string): EditResult {
	const edits: Edit[] = [];
	const escaped = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*"${escaped}"`, 'gi');
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		if (isCodeOrInlineCode(content, match.index)) {
			continue;
		}
		const fullMatch = match[0];
		const srcIndex = fullMatch.toLowerCase().lastIndexOf('src=');
		const afterSrc = fullMatch.slice(srcIndex + 4).trim();
		const quote = afterSrc[0] || '"';
		const replacement = fullMatch.slice(0, srcIndex) + `src=${quote}${newSrc}${quote}`;
		edits.push({
			start: match.index,
			end: re.lastIndex,
			replacement,
		});
	}
	return applyEdits(content, edits);
}

export function replaceFrontmatterUrl(content: string, oldUrl: string, newUrl: string): EditResult {
	const edits: Edit[] = [];
	const frontmatterRe = /^---\s*\r?\n([\s\S]*?)\r?\n---/;
	const fmMatch = frontmatterRe.exec(content);
	if (!fmMatch) {
		return { content, changed: false };
	}

	const frontmatter = fmMatch[1] ?? '';
	const fmStart = fmMatch.index + 4;
	const fmLines = frontmatter.split('\n');
	let lineOffset = fmStart;
	let changed = false;

	for (const line of fmLines) {
		const keyMatch = /^([a-zA-Z_-]+):\s*(https?:\/\/\S+)/.exec(line);
		if (keyMatch && keyMatch[2] === oldUrl) {
			const newLine = line.replace(oldUrl, newUrl);
			edits.push({
				start: lineOffset,
				end: lineOffset + line.length,
				replacement: newLine,
			});
			changed = true;
		}
		lineOffset += line.length + 1;
	}

	if (!changed) {
		return { content, changed: false };
	}

	return applyEdits(content, edits);
}

export function replaceAll(content: string, oldStr: string, newStr: string): EditResult {
	if (oldStr === newStr || !oldStr) {
		return { content, changed: false };
	}
	const result = content.split(oldStr).join(newStr);
	return { content: result, changed: result !== content };
}

export function insertAt(content: string, position: number, text: string): EditResult {
	const result = content.slice(0, position) + text + content.slice(position);
	return { content: result, changed: result !== content };
}