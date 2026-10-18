export type Category = 'work' | 'learn' | 'social' | 'life';
export interface Activity { id:string; title:string; url?:string; app:string; domain?:string; category:Category; kind:'app'|'page'|'interaction'; startedAt:number; duration:number; action?:'view'|'like'|'comment'|'save'|'share'|'click'; bookmarked?:boolean; excerpt?:string }
export interface Settings { recording:boolean; captureSocial:boolean; retentionDays:number; excludedDomains:string[]; excludedApps:string[]; focusGoalMinutes:number }
export interface AppState { events:Activity[]; settings:Settings; collector:{platform:string; extensionConnected:boolean; lastExtensionSeen?:number; error?:string} }
export interface MachAPI {getState():Promise<AppState>;updateSettings(settings:Partial<Settings>):Promise<AppState>;deleteEvent(id:string):Promise<AppState>;clearHistory():Promise<AppState>;bookmark(id:string,value:boolean):Promise<AppState>;getPairingToken():Promise<string>;openExternal(url:string):Promise<void>;onStateChanged(callback:()=>void):()=>void}
declare global { interface Window { mach?: MachAPI } }
