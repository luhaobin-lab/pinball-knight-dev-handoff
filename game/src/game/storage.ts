import type{SaveBlob}from'./api';
export const SAVE_KEY='guancaiban-xia.save.v0';
export interface SaveStorage{getItem(key:string):string|null;setItem(key:string,value:string):void}
/** Browser transport only. The core decides snapshot phases and fields; storage never serializes a world. */
export function readSave(storage:SaveStorage):SaveBlob|undefined{
 const raw=storage.getItem(SAVE_KEY);if(!raw)return undefined;
 try{const data=JSON.parse(raw)as Partial<SaveBlob>;if(data.version===0&&data.meta&&typeof data.meta==='object'&&!Array.isArray(data.meta)&&(data.run===null||typeof data.run==='object'&&data.run!==undefined&&!Array.isArray(data.run)))return data as SaveBlob;}catch{/* Preserve unrecognised bytes before a new source save replaces them. */}
 if(!storage.getItem(SAVE_KEY+'.unreadable'))storage.setItem(SAVE_KEY+'.unreadable',raw);return undefined;
}
export function persistSave(storage:SaveStorage,save:SaveBlob):void{storage.setItem(SAVE_KEY,JSON.stringify(save));}
