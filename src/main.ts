import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS } from './settings/settings';
import type { PluginSettings } from './settings/settings';

export default class UnifiedAttachmentManager extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new UnifiedAttachmentManagerSettingTab(this.app, this));
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

	getSettingDefinitions(): Record<string, { name: string; hint?: string }> {
		return {
			attachmentFolder: {
				name: 'Attachment folder',
				hint: 'Default location for saved attachments',
			},
		};
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Attachment folder')
			.setDesc('Default location for saved attachments')
			.addText((tc) => {
				tc.setValue(this.plugin.settings.attachmentFolder);
				tc.onChange(async (value: string) => {
					this.plugin.settings.attachmentFolder = value;
					await this.plugin.saveSettings();
				});
			});
	}
}