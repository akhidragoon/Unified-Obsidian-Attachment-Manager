export interface SaveSettings {
	attachmentFolder: string;
	showProgress: boolean;
}

export const DEFAULT_SAVE_SETTINGS: SaveSettings = {
	attachmentFolder: 'attachments',
	showProgress: true,
};