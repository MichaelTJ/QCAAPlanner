declare module 'adm-zip' {
	export default class AdmZip {
		constructor(buffer?: Buffer);
		getEntry(name: string): { getData(): Buffer } | null;
		getEntries(): { entryName: string; getData(): Buffer }[];
		updateFile(name: string, data: Buffer): void;
		addFile(entryName: string, content: Buffer, comment?: string, attr?: number): void;
		toBuffer(): Buffer;
	}
}
