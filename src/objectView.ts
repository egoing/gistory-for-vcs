import { dir } from 'console';
import * as vscode from 'vscode';
import {OPEN_COMMAND_ID} from './constant';
import {git} from './git';
type Node = { 
	key: string,
	ago: string,
	type: string
};
type FileType = {
	key: string,
	timeStamp:string|undefined,
	ago:number|undefined,
	type:string|undefined
};
type MemoizationType = {
	[index: string]:FileType
};
const { promisify } = require('util');
const { resolve } = require('path');
const fs = require("fs");
const path = require("path");
const moment = require('moment');

const getAllFiles = function(dirPath:string, arrayOfFiles:Array<FileType>|undefined=[]):Array<FileType> {
  let files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file:string) {
	let filePath = path.join(dirPath,"/",file);
	if (fs.statSync(filePath).isDirectory()) {
		arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
	} else {
		arrayOfFiles.push({
			key:filePath,
			timeStamp:undefined,
			ago:undefined,
			type:undefined
		});
	}
  });
  return arrayOfFiles;
};
export class ObjectView implements vscode.TreeDataProvider<Node>{
	constructor(context:vscode.ExtensionContext){
        const view = vscode.window.createTreeView('gistory.objectViewer', {
			treeDataProvider:this,
			showCollapseAll:true, 
			canSelectMany:true
		});
		context.subscriptions.push(view);        
		vscode.commands.registerCommand('gistory.objectViewer.refresh', () => this.refresh());
	}
	private memoization:MemoizationType = {};
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
	_getTreeItem(element: Node): vscode.TreeItem {
		let key = element.key;
		const treeElement = this._getTreeElement(key);
		// An example of how to use codicons in a MarkdownString in a tree item tooltip.
		const tooltip = new vscode.MarkdownString(`$(zap) Tooltip for ${key}`, true);
		let name = git.getPathFromRepo(key);
		let treeItemObject:vscode.TreeItem = {
			label: /**vscode.TreeItemLabel**/<any>{ label: `${element.ago}s : ${name}`, highlights: key.length > 1 ? [[key.length - 2, key.length - 1]] : void 0 },
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
				light: path.join(__filename, '..', '..', 'resources', 'light', element.type.toLocaleLowerCase()+'.svg'),
				dark: path.join(__filename, '..', '..', 'resources', 'dark', element.type.toLocaleLowerCase()+'.svg')
			};
		}
		return treeItemObject;
	}
	_getTreeElement(element: string, tree?: any): Node|undefined {
		for (const prop in tree) {
			if (prop === element) {
				return tree[prop];
			} else {
				const treeElement = this._getTreeElement(element, tree[prop]);
				if (treeElement) {
					return treeElement;
				}
			}
		}
		return undefined;
	}
	_getChildren(key: string): string[] {
		const treeElement = this._getTreeElement(key);
		if (treeElement) {
			return Object.keys(treeElement);
		}
		return [];
	}
	getChildren(element?: Node): any {
		if(element){
			
		} else {
			if(!vscode.workspace.workspaceFolders){
				return;
			}
			let files = getAllFiles(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,'.git'));
			files = files.map((file)=>{				
				if(this.memoization[file.key]){
					return this.memoization[file.key];
				}
				let stat = fs.statSync(file.key);
				file.timeStamp = moment(stat.ctime).unix();
				// file.ago = moment(stat.ctime).fromNow();
				file.ago = moment().unix()-moment(stat.ctime).unix();
				let type = git.getType(file.key);
				file.type = (type+'' === 'undefined' || type+'' === 'null' ? undefined : type+'')?.trim();
				this.memoization[file.key] = file;
				return file;
			});
			files.sort((e1, e2)=>{
				return Number(e2.timeStamp)-Number(e1.timeStamp);
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