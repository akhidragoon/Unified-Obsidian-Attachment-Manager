import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { DEFAULT_SETTINGS } from './settings/settings';
import type { PluginSettings } from './settings/settings';

export default class UnifiedAttachmentManager extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new UnifiedAttachmentManagerSettingTab(this.app, this));
		
		this.addCommand({
			id: 'localize-remote-images-current-note',
			name: 'Localize remote images in current note',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice('No active file');
					return;
				}
				new Notice('Scanning for remote images...');
			},
		});

		this.addCommand({
			id: 'localize-remote-images-folder',
			name: 'Localize remote images in folder',
			callback: () => {
				new Notice('Select a folder to process');
			},
		});

		this.addCommand({
			id: 'localize-remote-images-vault',
			name: 'Localize remote images across vault',
			callback: () => {
				new Notice('Vault-wide processing requires confirmation');
			},
		});

		this.addCommand({
			id: 'audit-attachment-links',
			name: 'Audit attachment links',
			callback: () => {
				new Notice('Running audit...');
			},
		});

		this.addCommand({
			id: 'preview-attachment-organization',
			name: 'Preview attachment organization',
			callback: () => {
				new Notice('Generating organization preview...');
			},
		});

		this.addCommand({
			id: 'find-duplicate-attachments',
			name: 'Find duplicate attachments',
			callback: () => {
				new Notice('Scanning for duplicates...');
			},
		});

		this.addCommand({
			id: 'review-unused-attachments',
			name: 'Review potentially unused attachments',
			callback: () => {
				new Notice('Scanning for orphaned files...');
			},
		});

		this.addCommand({
			id: 'undo-last-operation',
			name: 'Undo last operation',
			callback: () => {
				new Notice('No operations to undo');
			},
		});
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) } as PluginSettings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class UnifiedAttachmentManagerSettingTab extends PluginSettingTab {
	plugin: UnifiedAttachmentManager;

	constructor(app: App, plugin: UnifiedAttachmentManager) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Unified attachment manager').setHeading();

		new Setting(containerEl)
			.setName('Attachment folder')
			.setDesc('Default location for saved attachments')
			.addText((tc) => {
				tc.setPlaceholder('Attachments');
				tc.setValue(this.plugin.settings.attachmentFolder);
				tc.onChange(async (value: string) => {
					this.plugin.settings.attachmentFolder = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Download timeout (seconds)')
			.setDesc('Network timeout for downloading images')
			.addText((tc) => {
				tc.setPlaceholder('30');
				tc.setValue(String(this.plugin.settings.downloadTimeout || 30000));
				tc.onChange(async (value: string) => {
					const num = parseInt(value);
					if (!isNaN(num)) {
						this.plugin.settings.downloadTimeout = num * 1000;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Max download size (MB)')
			.setDesc('Maximum file size to download')
			.addText((tc) => {
				tc.setPlaceholder('10');
				tc.setValue(String(this.plugin.settings.maxDownloadSize || 10485760));
				tc.onChange(async (value: string) => {
					const num = parseInt(value);
					if (!isNaN(num)) {
						this.plugin.settings.maxDownloadSize = num * 1048576;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Preview before write')
			.setDesc('Always show preview before applying changes')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.previewBeforeWrite ?? true);
				toggle.onChange(async (value) => {
					this.plugin.settings.previewBeforeWrite = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Backup history')
			.setDesc('Number of operations to keep for undo')
			.addSlider((slider) => {
				slider.setLimits(0, 10, 1);
				slider.setValue(this.plugin.settings.backupHistory ?? 5);
				slider.setDynamicTooltip();
				slider.onChange(async (value) => {
					this.plugin.settings.backupHistory = value;
					await this.plugin.saveSettings();
				});
			});
	}
}