import { describe, it, expect } from 'vitest';
import {
	getEffectiveAttachmentFolder,
	ensureAttachmentSubfolder,
	getTargetAttachmentPath,
	sanitizeFilename,
	generateUniqueFilename,
	isAttachmentPath,
	resolveAttachmentPath,
	moveAttachment,
	renameAttachment,
	createDefaultPolicy,
	getObsidianDefaultPolicy,
	AttachmentPolicy,
} from '../../src/services/attachment-manager';

describe('Attachment Manager', () => {
	const defaultPolicy: AttachmentPolicy = {
		attachmentFolder: 'attachments',
		alwaysUseSubfolder: false,
		enabled: true,
	};

	const subfolderPolicy: AttachmentPolicy = {
		attachmentFolder: 'attachments',
		alwaysUseSubfolder: true,
		enabled: true,
	};

	describe('getEffectiveAttachmentFolder', () => {
		it('should return note directory when not using subfolder', () => {
			const folder = getEffectiveAttachmentFolder('notes/my-note.md', defaultPolicy);
			expect(folder).toBe('notes');
		});

		it('should return note dir + attachment folder when using subfolder', () => {
			const folder = getEffectiveAttachmentFolder('notes/my-note.md', subfolderPolicy);
			expect(folder).toBe('notes/attachments');
		});

		it('should handle root note path', () => {
			const folder = getEffectiveAttachmentFolder('my-note.md', defaultPolicy);
			expect(folder).toBe('');
		});

		it('should handle root note with subfolder', () => {
			const folder = getEffectiveAttachmentFolder('my-note.md', subfolderPolicy);
			expect(folder).toBe('attachments');
		});

		it('should handle nested folders', () => {
			const folder = getEffectiveAttachmentFolder('projects/alpha/beta/note.md', subfolderPolicy);
			expect(folder).toBe('projects/alpha/beta/attachments');
		});
	});

	describe('ensureAttachmentSubfolder', () => {
		it('should return success with effective folder when subfolder enabled', () => {
			const result = ensureAttachmentSubfolder('notes/note.md', subfolderPolicy);
			expect(result.success).toBe(true);
			expect(result.folderPath).toBe('notes/attachments');
		});

		it('should return effective folder when subfolder disabled', () => {
			const result = ensureAttachmentSubfolder('notes/note.md', defaultPolicy);
			expect(result.success).toBe(true);
			expect(result.folderPath).toBe('notes');
		});
	});

	describe('getTargetAttachmentPath', () => {
		it('should return path in note folder when subfolder disabled', () => {
			const path = getTargetAttachmentPath('notes/note.md', 'image.png', defaultPolicy);
			expect(path).toBe('notes/image.png');
		});

		it('should return path in attachment subfolder when enabled', () => {
			const path = getTargetAttachmentPath('notes/note.md', 'image.png', subfolderPolicy);
			expect(path).toBe('notes/attachments/image.png');
		});

		it('should handle root note', () => {
			const path = getTargetAttachmentPath('note.md', 'image.png', subfolderPolicy);
			expect(path).toBe('attachments/image.png');
		});
	});

	describe('sanitizeFilename', () => {
		it('should replace invalid characters', () => {
			expect(sanitizeFilename('file<>:"/\\|?*.png')).toBe('file________.png');
		});

		it('should remove leading/trailing dots', () => {
			expect(sanitizeFilename('...file...')).toBe('file');
			expect(sanitizeFilename('.hidden')).toBe('hidden');
		});

		it('should collapse multiple underscores', () => {
			expect(sanitizeFilename('file__name')).toBe('file_name');
		});

		it('should handle empty filename', () => {
			expect(sanitizeFilename('')).toBe('unnamed');
			expect(sanitizeFilename('   ')).toBe('unnamed');
		});

		it('should preserve valid filenames', () => {
			expect(sanitizeFilename('normal-file_name.png')).toBe('normal-file_name.png');
		});
	});

	describe('generateUniqueFilename', () => {
		it('should return original if not in existing', () => {
			const result = generateUniqueFilename('image.png', new Set(['other.png']));
			expect(result).toBe('image.png');
		});

		it('should append counter if exists', () => {
			const result = generateUniqueFilename('image.png', new Set(['image.png']));
			expect(result).toBe('image_1.png');
		});

		it('should find next available number', () => {
			const existing = new Set(['image.png', 'image_1.png', 'image_2.png']);
			const result = generateUniqueFilename('image.png', existing);
			expect(result).toBe('image_3.png');
		});

		it('should handle files without extension', () => {
			const result = generateUniqueFilename('readme', new Set(['readme']));
			expect(result).toBe('readme_1');
		});

		it('should handle hidden files', () => {
			const result = generateUniqueFilename('.gitignore', new Set(['.gitignore']));
			expect(result).toBe('.gitignore_1');
		});
	});

	describe('isAttachmentPath', () => {
		it('should return true for paths in attachment folder', () => {
			expect(isAttachmentPath('notes/attachments/image.png', subfolderPolicy)).toBe(true);
			expect(isAttachmentPath('attachments/image.png', subfolderPolicy)).toBe(true);
		});

		it('should return false for paths outside attachment folder', () => {
			expect(isAttachmentPath('notes/image.png', subfolderPolicy)).toBe(false);
			expect(isAttachmentPath('other/folder/file.png', subfolderPolicy)).toBe(false);
		});

		it('should be case insensitive', () => {
			expect(isAttachmentPath('notes/ATTACHMENTS/image.png', subfolderPolicy)).toBe(true);
		});
	});

	describe('resolveAttachmentPath', () => {
		it('should resolve attachment path with subfolder', () => {
			const path = resolveAttachmentPath('image.png', 'notes/note.md', subfolderPolicy);
			expect(path).toBe('notes/attachments/image.png');
		});

		it('should resolve attachment path without subfolder', () => {
			const path = resolveAttachmentPath('image.png', 'notes/note.md', defaultPolicy);
			expect(path).toBe('notes/image.png');
		});
	});

	describe('moveAttachment', () => {
		it('should return same path if source equals target', () => {
			const result = moveAttachment('a.png', 'a.png', new Set());
			expect(result.success).toBe(true);
			expect(result.newPath).toBe('a.png');
		});

		it('should generate unique path if target exists', () => {
			const result = moveAttachment('old.png', 'new.png', new Set(['new.png']));
			expect(result.success).toBe(true);
			expect(result.newPath).toBe('new_1.png');
		});
	});

	describe('renameAttachment', () => {
		it('should rename keeping directory', () => {
			const result = renameAttachment('notes/attachments/old.png', 'new.png', new Set());
			expect(result.success).toBe(true);
			expect(result.newPath).toBe('notes/attachments/new.png');
		});

		it('should generate unique path if new name exists', () => {
			const result = renameAttachment('old.png', 'exists.png', new Set(['exists.png']));
			expect(result.success).toBe(true);
			expect(result.newPath).toBe('exists_1.png');
		});
	});

	describe('createDefaultPolicy', () => {
		it('should create policy with defaults', () => {
			const policy = createDefaultPolicy();
			expect(policy.attachmentFolder).toBe('attachments');
			expect(policy.alwaysUseSubfolder).toBe(false);
			expect(policy.enabled).toBe(true);
		});
	});

	describe('getObsidianDefaultPolicy', () => {
		it('should create policy matching Obsidian defaults', () => {
			const policy = getObsidianDefaultPolicy();
			expect(policy.attachmentFolder).toBe('attachments');
			expect(policy.alwaysUseSubfolder).toBe(true);
			expect(policy.enabled).toBe(true);
		});
	});
});