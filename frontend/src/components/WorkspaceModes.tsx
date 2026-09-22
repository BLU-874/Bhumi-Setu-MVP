export const WORKSPACE_MODES = [
 {id:'synthetic_benchmark', label:'Synthetic Benchmark'},
 {id:'real_world_reference', label:'Real-World Dataset'},
] as const;
export type WorkspaceMode = typeof WORKSPACE_MODES[number]['id'];

export default function WorkspaceModes({mode,onChange}:{mode:WorkspaceMode;onChange:(mode:WorkspaceMode)=>void}){
 return <div className="workspace-modes" role="group" aria-label="Workspace mode">
 {WORKSPACE_MODES.map(item=><button key={item.id} aria-pressed={mode===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>)}
 </div>;
}
