
import { dir } from 'console';
import * as vscode from 'vscode';
import {OPEN_COMMAND_ID} from './constant';
type Node = { key: string };
const { promisify } = require('util');
const { resolve } = require('path');
const fs = require("fs");
const path = require("path");

 

const getAllFiles = function(dirPath:string, arrayOfFiles) {
  let files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
	let filePath = path.join(dirPath,"/",file);
	if (fs.statSync(filePath).isDirectory()) {
		arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
	} else {
		arrayOfFiles.push({key:filePath});
	}
  });
  return arrayOfFiles;
};

export class ObjectView implements vscode.TreeDataProvider<Node>{
	public files;
	constructor(context:vscode.ExtensionContext){
        const view = vscode.window.createTreeView('objectView', {
			treeDataProvider:this,
			showCollapseAll:true, 
			canSelectMany:true
		});
		context.subscriptions.push(view);        
		
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
			label: /**vscode.TreeItemLabel**/<any>{ label: path.basename(key), highlights: key.length > 1 ? [[key.length - 2, key.length - 1]] : void 0 },
			tooltip,
			collapsibleState: treeElement && Object.keys(treeElement).length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
			resourceUri: vscode.Uri.parse(`/tmp/${key}`),
			command: {
				command:OPEN_COMMAND_ID,
				title:'Open File',
				arguments:[key]
			}
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
	getChildren(element?: Node): vscode.ProviderResult<[]> {
		if(element){

		} else {
			let files = getAllFiles(path.join(vscode.workspace.workspaceFolders[0].uri.path,'.git'));
			return Promise.resolve(files);
		}
	  
		// let childs = this._getChildren(element ? element.key : undefined);
		// let newChilds = childs.map(key => this._getNode(key));
		// return newChilds;

	}
}
class Key {
	constructor(readonly key: string) { }
}