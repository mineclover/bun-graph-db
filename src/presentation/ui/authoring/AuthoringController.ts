import type { AuthoringCommand } from "@/presentation/ui/contracts.js";

export interface AuthoringHistoryState {
	canUndo: boolean;
	canRedo: boolean;
	undoLabel: string | null;
	redoLabel: string | null;
	depth: number;
}

export class AuthoringCommandStack {
	private readonly undoStack: AuthoringCommand[] = [];
	private readonly redoStack: AuthoringCommand[] = [];
	private readonly listeners = new Set<(state: AuthoringHistoryState) => void>();

	constructor(private readonly maxEntries = 50) {}

	async execute<T>(command: AuthoringCommand<T>): Promise<T> {
		const result = await command.execute();
		this.undoStack.push(command);
		if (this.undoStack.length > this.maxEntries) {
			this.undoStack.shift();
		}
		this.redoStack.length = 0;
		this.emit();
		return result;
	}

	async undo(): Promise<string | null> {
		const command = this.undoStack.pop();
		if (!command) return null;
		await command.undo();
		this.redoStack.push(command);
		this.emit();
		return command.label;
	}

	async redo(): Promise<string | null> {
		const command = this.redoStack.pop();
		if (!command) return null;
		await command.execute();
		this.undoStack.push(command);
		this.emit();
		return command.label;
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	getState(): AuthoringHistoryState {
		const topUndo = this.undoStack[this.undoStack.length - 1];
		const topRedo = this.redoStack[this.redoStack.length - 1];
		return {
			canUndo: this.undoStack.length > 0,
			canRedo: this.redoStack.length > 0,
			undoLabel: topUndo?.label ?? null,
			redoLabel: topRedo?.label ?? null,
			depth: this.undoStack.length,
		};
	}

	clear(): void {
		this.undoStack.length = 0;
		this.redoStack.length = 0;
		this.emit();
	}

	subscribe(listener: (state: AuthoringHistoryState) => void): () => void {
		this.listeners.add(listener);
		listener(this.getState());
		return () => {
			this.listeners.delete(listener);
		};
	}

	private emit(): void {
		const snapshot = this.getState();
		for (const listener of this.listeners) {
			listener(snapshot);
		}
	}
}
