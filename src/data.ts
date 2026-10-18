import type {Activity,AppState,Settings} from './types';
import {createDemoState} from './demo';
const KEY='mach-demo-v1';
export const isDemo=!window.mach;
function demoState():AppState {try {const saved=localStorage.getItem(KEY);if(saved){const state=JSON.parse(saved);if(Array.isArray(state.events)&&state.settings&&state.collector)return state;}}catch{/* recover unavailable or stale storage */}return createDemoState();}
let memory:AppState|undefined;
async function save(state:AppState) {memory=state;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* Preview remains usable if browser storage is unavailable. */}return structuredClone(state);}
export const api={
 async getState():Promise<AppState>{return window.mach?window.mach.getState():structuredClone(memory??(memory=demoState()));},
 async updateSettings(partial:Partial<Settings>){if(window.mach)return window.mach.updateSettings(partial);const state=await this.getState();return save({...state,settings:{...state.settings,...partial}});},
 async bookmark(id:string,value:boolean){if(window.mach)return window.mach.bookmark(id,value);const state=await this.getState();return save({...state,events:state.events.map(event=>event.id===id?{...event,bookmarked:value}:event)});},
 async deleteEvent(id:string){if(window.mach)return window.mach.deleteEvent(id);const state=await this.getState();return save({...state,events:state.events.filter(event=>event.id!==id)});},
 async clearHistory(){if(window.mach)return window.mach.clearHistory();const state=await this.getState();return save({...state,events:[]});},
 async resetDemo(){return save(createDemoState());}
};
export function openLink(url?:string){if(!url)return;try{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))return;if(window.mach)void window.mach.openExternal(parsed.href);else window.open(parsed.href,'_blank','noopener,noreferrer');}catch{/* Ignore invalid stored URLs. */}}
export function downloadEvents(events:Activity[],format:'json'|'csv'){
 const csvCell=(v:unknown)=>{let value=String(v??'');if(/^[=+\-@\t\r]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';};
 const body=format==='json'?JSON.stringify({app:'Mạch',version:1,exportedAt:new Date().toISOString(),events},null,2):'\uFEFF'+[['Thời điểm','Ứng dụng','Tiêu đề','URL','Danh mục','Loại','Thời gian (giây)','Thao tác','Đã lưu'],...events.map(e=>[new Date(e.startedAt).toISOString(),e.app,e.title,e.url,e.category,e.kind,e.duration,e.action,!!e.bookmarked])].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([body],{type:format==='json'?'application/json':'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`mach-${new Date().toISOString().slice(0,10)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
