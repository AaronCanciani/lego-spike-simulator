<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as Blockly from 'blockly/core';
  import 'blockly/blocks';
  import * as En from 'blockly/msg/en';
  import '$lib/blockly/render';
  import '$lib/blockly/theme';
  import '$lib/blockly/field_variable_getter';
  import '$lib/blockly/field-bitmap';
  import '$lib/blockly/field-grid-dropdown';
  import '$lib/blockly/field-ultra-sound';
  import '$lib/blockly/field-sound';
  import '$lib/blockly/field_metadata';
  import { registerFieldAngle } from '$lib/blockly/field_angle';
  import { registerFieldColour } from '@blockly/field-colour';
  import { procedureBlocks } from '$lib/blockly/procedure_blocks';
  import { registerInputShadowExtension, applyInputShadowExtension } from '$lib/blockly/shadow_input';
  import { registerProcedureCallExtension } from '$lib/blockly/procedure_call_extension';
  import { blocks } from '$lib/blockly/blocks';
  import { convertToBlockly } from '$lib/scratch/blockly';
  import type { Project } from './engine';
  export let project: Project|null=null;
  export let active: string[]=[];
  export let follow=true;
  let host:HTMLDivElement, workspace:Blockly.WorkspaceSvg, observer:ResizeObserver;
  let loaded:Project|null=null, lastRoot='', lastActive='', issue='';
  export function focus(id:string) {if(workspace?.getBlockById(id)){workspace.centerOnBlock(id);lastRoot=workspace.getBlockById(id)!.getRootBlock().id;}}
  export function zoom(delta:number) {workspace?.zoomCenter(delta);}
  export function fit() {workspace?.zoomToFit();}
  async function load(p:Project) {
    loaded=p;issue='';
    try {
      workspace.clear(); await tick();
      const state=convertToBlockly(p as any);if(!state)throw new Error('Unable to display this project.');
      Blockly.serialization.workspaces.load(state,workspace);
      const tops=workspace.getTopBlocks(false).sort((a,b)=>(a.type==='flipperevents_whenProgramStarts'?-1:b.type==='flipperevents_whenProgramStarts'?1:0));
      let defY=30, looseY=30;
      for(const b of tops) {const point=b.getRelativeToSurfaceXY(), isMain=b.type==='flipperevents_whenProgramStarts', def=b.type==='procedures_definition';b.moveBy((isMain?40:def?820:1750)-point.x,(isMain?30:def?defY:looseY)-point.y);if(def)defY+=b.getHeightWidth().height+70;else if(!isMain)looseY+=b.getHeightWidth().height+60;}
      workspace.setScale(.72); Blockly.svgResize(workspace);
      if(tops[0]){workspace.scroll(28,28);lastRoot=tops[0].id;}
      lastActive='';
    }catch(e){issue=e instanceof Error?e.message:String(e);}
  }
  function highlight(ids:string[]) {
    if(!workspace)return;
    const key=ids.join('|');if(lastActive===key)return;lastActive=key;
    workspace.highlightBlock(null);
    for(const id of ids)workspace.highlightBlock(id,true);
    const b=workspace.getBlockById(ids[0]);
    if(follow&&b) {
      const root=b.getRootBlock().id;
      const rect=b.getSvgRoot()?.getBoundingClientRect(), viewport=host.getBoundingClientRect();
      if(root!==lastRoot||(rect&&(rect.top<viewport.top+20||rect.bottom>viewport.bottom-40)))focus(b.id);
    }
  }
  onMount(()=>{
    registerFieldAngle();registerFieldColour();Blockly.setLocale(En as any);
    Blockly.common.defineBlocksWithJsonArray(procedureBlocks);registerInputShadowExtension(Blockly);registerProcedureCallExtension(Blockly);Blockly.defineBlocksWithJsonArray(blocks);applyInputShadowExtension(Blockly);
    workspace=Blockly.inject(host,{renderer:'spike_renderer',theme:'spike',readOnly:true,media:'/blockly/media/',grid:{spacing:24,length:2,colour:'#cbd4dd',snap:false},zoom:{controls:false,wheel:true,startScale:.72,minScale:.25,maxScale:1.5},move:{scrollbars:true,drag:true,wheel:true}});
    observer=new ResizeObserver(()=>Blockly.svgResize(workspace));observer.observe(host);
    if(project)load(project);
  });
  onDestroy(()=>{observer?.disconnect();workspace?.dispose();});
  $: if(workspace&&project&&loaded!==project)load(project);
  $: if(workspace)highlight(active);
</script>
<div class="program-canvas" bind:this={host}></div>
{#if issue}<div class="display-error" role="alert">Block viewer: {issue}</div>{/if}
<style>.program-canvas{width:100%;height:100%;min-height:250px}.display-error{position:absolute;inset:30px;background:#fff0ef;padding:24px;color:#a32929;z-index:4}</style>
