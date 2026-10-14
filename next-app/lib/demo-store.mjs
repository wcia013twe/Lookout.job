// A disposable store: no localStorage, account switching, backend or file access.
export function createDemoStore(initial) {
 let state=structuredClone(initial);
 const listeners=new Set();
 const clone=value=>value===undefined?undefined:structuredClone(value);
 const read=(path='')=>path?path.split('.').reduce((value,key)=>value?.[key],state):state;
 function publish(){for(const listener of listeners)listener(clone(state));}
 return {
  get(path){return clone(read(path));},
  set(path,value){if(!path)state=clone(value);else{const keys=path.split('.');let target=state;for(const key of keys.slice(0,-1))target=target[key] ||= {};target[keys.at(-1)]=clone(value);}publish();},
  update(path,fn){this.set(path,fn(this.get(path)));},
  subscribe(_path,fn){listeners.add(fn);return()=>listeners.delete(fn);},
  reset(value){state=clone(value);publish();},
  _flush(){},
 };
}
