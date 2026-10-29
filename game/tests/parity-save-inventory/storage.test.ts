import{it,expect}from'vitest';import{readSave,persistSave,SAVE_KEY,type SaveStorage}from'../../src/game/storage';
function store(){const data=new Map<string,string>();return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v)}}satisfies SaveStorage&{data:Map<string,string>};}
it('browser transport preserves v0 data and retains unreadable preexisting bytes instead of erasing them',()=>{
 const s=store();expect(readSave(s)).toBeUndefined();s.setItem(SAVE_KEY,'{"version":99,"existing":"keep"}');expect(readSave(s)).toBeUndefined();expect(s.getItem(SAVE_KEY)).toContain('existing');expect(s.getItem(SAVE_KEY+'.unreadable')).toBe(s.getItem(SAVE_KEY));
 const save={version:0,meta:{'新手关过？':true},run:{actorSnapshot:{inventory:{version:1,cards:[]}}}};persistSave(s,save);expect(readSave(s)).toEqual(save);expect(s.getItem(SAVE_KEY+'.unreadable')).toContain('existing');
});
