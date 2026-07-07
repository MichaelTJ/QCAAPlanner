/** JSON snapshot for comparing editable document state. */
export function snapshotValue<T>(value: T): string {
	return JSON.stringify(value);
}

export function isDirtySnapshot<T>(value: T, snapshot: string): boolean {
	return JSON.stringify(value) !== snapshot;
}
