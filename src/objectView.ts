import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OPEN_COMMAND_ID } from './constant';
import { git } from './git';

type Node = { key: string; label: string; directory: boolean; workspace?: boolean; ago?: number; type?: string };

export function workspaceGitRoots(folders: readonly vscode.WorkspaceFolder[]): Node[] {
	return folders.reduce((nodes: Node[], folder) => {
		const gitDir = git.getGitDir(folder.uri.fsPath);
		if (gitDir) { nodes.push({ key: gitDir, label: folder.name, directory: true, workspace: true }); }
		return nodes;
	}, []);
}

export class ObjectView implements vscode.TreeDataProvider<Node> {
	private readonly emitter = new vscode.EventEmitter<Node | undefined>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(context: vscode.ExtensionContext) {
		const view = vscode.window.createTreeView('gistory.objectViewer', { treeDataProvider: this, showCollapseAll: true });
		context.subscriptions.push(view, this.emitter);
		context.subscriptions.push(vscode.commands.registerCommand('gistory.objectViewer.refresh', () => this.refresh()));
		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()));
	}

	refresh(): void { this.emitter.fire(undefined); }

	getTreeItem(element: Node): vscode.TreeItem {
		const item = new vscode.TreeItem(element.label, element.directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		item.id = element.key;
		item.resourceUri = vscode.Uri.file(element.key);
		if (element.ago !== undefined) {item.description = `${element.ago}s`;}
		const icon = element.directory ? 'folder' : element.type === 'OBJECT' ? 'unknown' : element.type?.toLowerCase();
		if (icon) {item.iconPath = {
			light: path.join(__dirname, '..', 'resources', 'light', `${icon}.svg`),
			dark: path.join(__dirname, '..', 'resources', 'dark', `${icon}.svg`)
		};}
		if (!element.directory) {item.command = { command: OPEN_COMMAND_ID, title: 'Open File', arguments: [element.key] };}
		return item;
	}

	async getChildren(element?: Node): Promise<Node[]> {
		if (!element) {
			const folders = vscode.workspace.workspaceFolders || [];
			return workspaceGitRoots(folders);
		}
		const directory = element.key;
		let entries: fs.Dirent[];
		try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
		catch (_error) { return []; }
		const children = await Promise.all(entries.map(async entry => {
			const key = path.join(directory, entry.name);
			const isDirectory = entry.isDirectory();
			let ago: number | undefined;
			try { ago = Math.max(0, Math.floor((Date.now() - (await fs.promises.stat(key)).ctimeMs) / 1000)); }
			catch (_error) { /* The file may have disappeared. */ }
			return { key, label: entry.name, directory: isDirectory, ago, type: isDirectory ? undefined : git.getType(key) };
		}));
		return children.sort((a, b) => Number(b.directory) - Number(a.directory) || (b.ago ?? 0) - (a.ago ?? 0) || a.label.localeCompare(b.label));
	}
}
