import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OPEN_COMMAND_ID } from './constant';
import { git } from './git';

export type RecentFile = { key: string; label: string; modifiedAt: number; type: string };

export async function collectRecentFiles(folders: readonly vscode.WorkspaceFolder[]): Promise<RecentFile[]> {
	const files = new Map<string, { file: RecentFile; gitDirLength: number }>();
	const multipleRepositories = folders.length > 1;
	for (const folder of folders) {
		const gitDir = git.getGitDir(folder.uri.fsPath);
		if (!gitDir) {continue;}
		const scan = async (directory: string): Promise<void> => {
			let entries: fs.Dirent[];
			try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
			catch (_error) { return; }
			const subdirectories: string[] = [];
			await Promise.all(entries.map(async entry => {
				const key = path.join(directory, entry.name);
				if (entry.isDirectory()) {subdirectories.push(key); return;}
				if (!entry.isFile()) {return;}
				try {
					const stat = await fs.promises.stat(key);
					const relative = path.relative(gitDir, key);
					const file: RecentFile = {
						key,
						label: multipleRepositories ? `${folder.name}: ${relative}` : relative,
						modifiedAt: stat.mtimeMs,
						type: git.getTypeInGitDir(gitDir, key)
					};
					const previous = files.get(key);
					if (!previous || gitDir.length > previous.gitDirLength) {
						files.set(key, { file, gitDirLength: gitDir.length });
					}
				} catch (_error) { /* A file can disappear while Git is writing. */ }
			}));
			for (const subdirectory of subdirectories) {await scan(subdirectory);}
		};
		await scan(gitDir);
	}
	return [...files.values()].map(entry => entry.file)
		.sort((a, b) => b.modifiedAt - a.modifiedAt || a.label.localeCompare(b.label));
}

function elapsedTime(modifiedAt: number): string {
	const seconds = Math.max(0, Math.floor((Date.now() - modifiedAt) / 1000));
	if (seconds < 60) {return `${seconds}초 전`;}
	if (seconds < 3600) {return `${Math.floor(seconds / 60)}분 전`;}
	if (seconds < 86400) {return `${Math.floor(seconds / 3600)}시간 전`;}
	return `${Math.floor(seconds / 86400)}일 전`;
}

export class ObjectView implements vscode.TreeDataProvider<RecentFile> {
	private readonly emitter = new vscode.EventEmitter<RecentFile | undefined>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(context: vscode.ExtensionContext) {
		const view = vscode.window.createTreeView('gistory.objectViewer', { treeDataProvider: this });
		context.subscriptions.push(view, this.emitter);
		context.subscriptions.push(vscode.commands.registerCommand('gistory.objectViewer.refresh', () => this.refresh()));
		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()));
	}

	refresh(): void { this.emitter.fire(undefined); }

	getTreeItem(element: RecentFile): vscode.TreeItem {
		const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
		item.id = element.key;
		item.resourceUri = vscode.Uri.file(element.key);
		item.description = elapsedTime(element.modifiedAt);
		item.tooltip = `${element.key}\n내용 변경: ${new Date(element.modifiedAt).toLocaleString()}`;
		const icon = element.type === 'OBJECT' ? 'unknown' : element.type.toLowerCase();
		item.iconPath = {
			light: path.join(__dirname, '..', 'resources', 'light', `${icon}.svg`),
			dark: path.join(__dirname, '..', 'resources', 'dark', `${icon}.svg`)
		};
		item.command = { command: OPEN_COMMAND_ID, title: 'Open File', arguments: [element.key] };
		return item;
	}

	getChildren(element?: RecentFile): Promise<RecentFile[]> | RecentFile[] {
		if (element) {return [];}
		return collectRecentFiles(vscode.workspace.workspaceFolders || []);
	}
}
