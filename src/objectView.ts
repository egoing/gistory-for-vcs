import * as vscode from 'vscode';
import { OPEN_COMMAND_ID } from './constant';
import { git } from './git';
import * as fs from 'fs';
import * as path from 'path';

type Node = { key: string; label: string; directory: boolean; ago?: number; type?: string };

export class ObjectView implements vscode.TreeDataProvider<Node> {
	private readonly emitter = new vscode.EventEmitter<Node | undefined>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(context: vscode.ExtensionContext) {
		const view = vscode.window.createTreeView('gistory.objectViewer', {
			treeDataProvider: this,
			showCollapseAll: true,
			canSelectMany: true
		});
		context.subscriptions.push(view, this.emitter);
		context.subscriptions.push(vscode.commands.registerCommand('gistory.objectViewer.refresh', () => this.refresh()));
	}

	refresh(): void { this.emitter.fire(undefined); }

	getTreeItem(element: Node): vscode.TreeItem {
		const item = new vscode.TreeItem(element.label, element.directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		item.id = element.key;
		item.resourceUri = vscode.Uri.file(element.key);
		if (element.directory) item.contextValue = 'gistoryDirectory';
		if (element.ago !== undefined) item.description = `${element.ago}s`;
		if (element.type) item.iconPath = {
			light: path.join(__dirname, '..', 'resources', 'light', `${element.type.toLowerCase()}.svg`),
			dark: path.join(__dirname, '..', 'resources', 'dark', `${element.type.toLowerCase()}.svg`)
		};
		if (!element.directory) item.command = { command: OPEN_COMMAND_ID, title: 'Open File', arguments: [element.key] };
		return item;
	}

	getChildren(element?: Node): Node[] {
		const workspace = vscode.workspace.workspaceFolders?.[0];
		if (!workspace) return [];
		const gitDir = git.getGitDir(path.join(workspace.uri.fsPath, '.git'));
		if (!gitDir) return [];
		const directory = element?.key ?? gitDir;
		let entries: fs.Dirent[];
		try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_error) { return []; }
		return entries.map(entry => {
			const key = path.join(directory, entry.name);
			const isDirectory = entry.isDirectory();
			let ago: number | undefined;
			try { ago = Math.max(0, Math.floor((Date.now() - fs.statSync(key).ctimeMs) / 1000)); } catch (_error) { /* File may disappear during refresh. */ }
			return { key, label: entry.name, directory: isDirectory, ago, type: isDirectory ? undefined : git.getType(key) };
		}).sort((a, b) => Number(b.directory) - Number(a.directory) || (b.ago ?? 0) - (a.ago ?? 0) || a.label.localeCompare(b.label));
	}
}
