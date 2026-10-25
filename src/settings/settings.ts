export interface PluginSettings {
	attachmentFolder: string;
	showProgress: boolean;
	maxDownloadSize: number;
	downloadTimeoutSeconds: number;
	downloadTimeout?: number;
	previewBeforeWrite?: boolean;
	backupHistory?: number;
	alwaysUseSubfolder?: boolean;
	namingPolicy?: string;
	duplicateDetection?: 'url' | 'content';
}

export const DEFAULT_SETTINGS: PluginSettings = {
	attachmentFolder: 'attachments',
	showProgress: true,
	maxDownloadSize: 10485760,
	downloadTimeoutSeconds: 30,
	downloadTimeout: 30000,
	previewBeforeWrite: true,
	backupHistory: 5,
	alwaysUseSubfolder: true,
	namingPolicy: 'sanitize',
	duplicateDetection: 'url',
};