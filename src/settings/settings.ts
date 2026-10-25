export interface PluginSettings {
	attachmentFolder: string;
	showProgress: boolean;
	maxDownloadSize: number;
	downloadTimeoutSeconds: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	attachmentFolder: 'attachments',
	showProgress: true,
	maxDownloadSize: 10485760,
	downloadTimeoutSeconds: 30,
};