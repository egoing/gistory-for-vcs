import { execSync } from "child_process";
import { TextDecoder } from "util";
import { delimiter } from "path";

export const git = {
	getRootPath:(fullPath:string):string|null=>{
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
	getType:(fullPath:string):string=>{
		let match = fullPath.match(/(.*)\.git[\/\\](.*)/);
		if(!match){
			return 'UNKNOWN';
		}
		let pattern;
		const beforePath = match[1];
		const afterPath = match[2];		
		if(afterPath==='HEAD'){
			return 'HEAD';
		} else if(afterPath==='index'){
			return 'INDEX';
		} else if(afterPath==='config'){
			return 'CONFIG';
		} else if(afterPath==='COMMIT_EDITMSG'){
			return 'COMMIT_EDITMSG';
		} else if(afterPath.match(/^hooks[\/\\](.+)/)){
			return 'HOOK';
		} else if(afterPath.match(/^info[\/\\]exclude/)){
			return 'EXCLUDE';
		} else if(afterPath.match(/^refs[\/\\]heads[\/\\](.+)/)){
			return 'BRANCH';
		} else if(afterPath.match(/^refs[\/\\]tags[\/\\](.+)/)){
			return 'TAG';
		} else if(afterPath.match(/^logs[\/\\]HEAD$/)){
			return 'LOG_REFS_HEADS';
		} else if(afterPath.match(/^logs[\/\\]refs[\/\\]heads[\/\\](.+)/)){
			return 'LOG_REFS_BRANCH_HEADS';
		} else if(pattern = fullPath.match(/\.git[\/\\]objects[\/\\](..)[\/\\](.{38})/)){
			let objectName = pattern[1]+pattern[2];
			let gitPath = git.getRootPath(fullPath);
			let contentType;
			if(gitPath){
				contentType = execSync(`git cat-file -t ${objectName}`, {cwd:gitPath});
			} else {
				contentType = 'UNKNOWN';
			}
			return (contentType+'').trim();
		} else if(fullPath.match(/objects[\/\\]pack[\/\\](.+)/)){
			return "PACK_FILE";
		}
		return 'UNKNOWN';
	}
};