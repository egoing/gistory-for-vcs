
import * as vscode from 'vscode';
type Node = { key: string };
const { promisify } = require('util');
const { resolve } = require('path');
const fs = require('fs');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

async function getFiles(dir:string) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir:string) => {
    const res = resolve(dir, subdir);
    return (await stat(res)).isDirectory() ? getFiles(res) : res;
  }));
  return files.reduce((a, f) => a.concat(f), []);
}
console.log(2);
export class ObjectView implements vscode.TreeDataProvider<Node>{
	public tree = {
		'a': {
			'aa': {
				'aaa': {
					'aaaa': {
						'aaaaa': {
							'aaaaaa': {

							}
						}
					}
				}
			},
			'ab': {}
		},
		'c': {
			'ba': {},
			'bb': {}
		}
	};
	constructor(context:vscode.ExtensionContext){
        const view = vscode.window.createTreeView('objectView', {
			treeDataProvider:this,
			showCollapseAll:true, 
			canSelectMany:true
		});
		context.subscriptions.push(view);
        // getFiles(vscode.workspace.workspaceFolders[0].uri.path).then(files=>console.log('files', files)); 
        
	}
	getTreeItem(element: Node): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem = this._getTreeItem(element.key);
		treeItem.id = element.key;
		return treeItem;
	}
	_getTreeItem(key: string): vscode.TreeItem {
		const treeElement = this._getTreeElement(key);
		// An example of how to use codicons in a MarkdownString in a tree item tooltip.
		const tooltip = new vscode.MarkdownString(`$(zap) Tooltip for ${key}`, true);
		return {
			label: /**vscode.TreeItemLabel**/<any>{ label: key, highlights: key.length > 1 ? [[key.length - 2, key.length - 1]] : void 0 },
			tooltip,
			collapsibleState: treeElement && Object.keys(treeElement).length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
			resourceUri: vscode.Uri.parse(`/tmp/${key}`),
		};
	}
	private nodes = {};
	_getTreeElement(element: string, tree?: any): Node {
		const currentNode = tree ?? this.tree;
		for (const prop in currentNode) {
			if (prop === element) {
				return currentNode[prop];
			} else {
				const treeElement = this._getTreeElement(element, currentNode[prop]);
				if (treeElement) {
					return treeElement;
				}
			}
		}
	}
	_getNode(key: string): Node {
		if (!this.nodes[key]) {
			this.nodes[key] = new Key(key);
		}
		return this.nodes[key];
	}
	_getChildren(key: string): string[] {
		if (!key) {
			return Object.keys(this.tree);
		}
		const treeElement = this._getTreeElement(key);
		if (treeElement) {
			return Object.keys(treeElement);
		}
		return [];
	}
	getChildren(element?: Node): vscode.ProviderResult<Node[]> {
		let childs = this._getChildren(element ? element.key : undefined);
		let newChilds = childs.map(key => this._getNode(key));
		return newChilds;
	}
}
class Key {
	constructor(readonly key: string) { }
}