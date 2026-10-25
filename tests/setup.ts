import { vi } from 'vitest';

vi.mock('obsidian', () => ({
	normalizePath: (path: string) => {
		if (!path) return path;
		return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
	},
	App: class MockApp {},
	Plugin: class MockPlugin {},
	TFile: class MockTFile {},
	TFolder: class MockTFolder {},
	Vault: class MockVault {},
	MarkdownFile: class MockMarkdownFile {},
	Notice: class MockNotice {
		constructor(public message: string) {}
	},
}));