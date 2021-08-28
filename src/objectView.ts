import { dir } from 'console';
import * as vscode from 'vscode';
import {OPEN_COMMAND_ID} from './constant';
import {git} from './git';
type Node = { key: string };
const { promisify } = require('util');
const { resolve } = require('path');
const fs = require("fs");
const path = require("path");
const moment = require('moment');

 

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
        const view = vscode.window.createTreeView('gitspector.objectViewer', {
			treeDataProvider:this,
			showCollapseAll:true, 
			canSelectMany:true
		});
		context.subscriptions.push(view);        
		vscode.commands.registerCommand('gitspector.objectViewer.refresh', () => this.refresh());
	}
	private _onDidChangeTreeData: vscode.EventEmitter<undefined | void> = new vscode.EventEmitter<undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<undefined | void> = this._onDidChangeTreeData.event;
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
	getTreeItem(element: Node): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem = this._getTreeItem(element);
		treeItem.id = element.key;
		return treeItem;
	}
	_getTreeItem(element: string): vscode.TreeItem {
		let key = element.key;
		const treeElement = this._getTreeElement(key);
		// An example of how to use codicons in a MarkdownString in a tree item tooltip.
		const tooltip = new vscode.MarkdownString(`$(zap) Tooltip for ${key}`, true);
		let basename = path.basename(key);
		let name = basename;
		let pattern = key.match(/objects[\/\\](..)[\/\\](.{38})/)
		if(pattern){
			name = (pattern[1]+pattern[2]).substr(0,7)+'...';
		}
		let treeItemObject = {
			label: /**vscode.TreeItemLabel**/<any>{ label: name+" : "+element.ago+" : "+element.type, highlights: key.length > 1 ? [[key.length - 2, key.length - 1]] : void 0 },
			tooltip,
			collapsibleState: treeElement && Object.keys(treeElement).length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
			resourceUri: vscode.Uri.parse(`/tmp/${key}`),
			command: {
				command:OPEN_COMMAND_ID,
				title:'Open File',
				arguments:[key]
			}
		};	

		if(element.type){
			treeItemObject.iconPath = {
				light: path.join(__filename, '..', '..', 'resources', 'light', element.type+'.svg'),
				dark: path.join(__filename, '..', '..', 'resources', 'dark', element.type+'.svg')
			};
		}
		return treeItemObject;
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
			let files = getAllFiles(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,'.git'));
			files.forEach((file)=>{
				let stat = fs.statSync(file.key);
				file.timeStamp = moment(stat.ctime).unix();
				file.ago = moment(stat.ctime).fromNow();
				let type = git.getType(file.key);
				file.type = (type+'' === 'undefined' || type+'' === 'null' ? undefined : type+'')?.trim();
			});
			files.sort((e1, e2)=>{
				return e2.timeStamp-e1.timeStamp;
			});			
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