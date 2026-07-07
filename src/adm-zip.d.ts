declare module 'adm-zip' {
	export default class AdmZip {
		constructor(buffer?: Buffer);
		getEntry(name: string): { getData(): Buffer } | null;
		updateFile(name: string, data: Buffer): void;
		toBuffer(): Buffer;
	}
}
