import { execSync } from "child_process";
import { TextDecoder } from "util";
import { delimiter } from "path";

export const git = {
	getRootPath:(fullPath:string)=>{
		let match = fullPath.match(/(.*)\.git/);
		if(!match){
			return null;
		}
		
		return match[1];
	},
	getPathFromRepo:(fullPath:string)=>{
		let match = fullPath.match(/(.*)\.git[\/\\](.*)/);
		if(!match){
			return null;
		}
		
		return match[2];
	},
	getType:(fullPath:string)=>{
		let match = fullPath.match(/(.*)\.git[\/\\](.*)/);
		if(!match){
			return null;
		}
		let pattern;
		if(match[2]==='HEAD'){
			return 'HEAD';
		} else if(pattern = fullPath.match(/objects[\/\\](..)[\/\\](.{38})/)){
			let objectName = pattern[1]+pattern[2];
			let gitPath = git.getRootPath(fullPath);
			console.log(`cd "${gitPath}";git cat-file -t ${objectName}`)
			let contentType = execSync(`git cat-file -t ${objectName}`, {cwd:gitPath});
			return (contentType+'').trim();
		}
		
	}
};