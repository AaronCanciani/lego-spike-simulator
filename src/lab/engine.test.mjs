import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine,defaultProfile,inspect,DT,wrap} from './engine.ts';

const ideal={...defaultProfile,mismatch:0,motorMismatch:0,slip:0,gyroBias:0,gyroNoise:0,response:.005};
const input=value=>[1,[4,String(value)]];
const block=(opcode,inputs={},fields={},next)=>({opcode,inputs,fields,next});
const program=(extra)=>({targets:[{blocks:{start:{...block('flipperevents_whenProgramStarts',{}, {},'go'),topLevel:true},...extra}}]});
const straight=program({go:block('flippermove_move',{DIRECTION:input('forward'),VALUE:input(1)},{UNIT:['rotations']})});
function finish(engine,limit=36010){engine.start();for(let i=0;i<limit&&engine.state==='running';i++)engine.step();return engine;}

test('one ideal wheel rotation travels one circumference, within the tick integration bound',()=>{
  const e=finish(new Engine(straight,ideal,{x:0,y:0,heading:0}));
  assert.equal(e.state,'finished');assert.ok(Math.abs(e.y-defaultProfile.wheel*Math.PI)<4);assert.ok(Math.abs(e.x)<.001);assert.ok(Math.abs(e.heading)<.001);
});
test('same seed reproduces path, sensor readings and execution timing exactly',()=>{
  const a=finish(new Engine(straight)),b=finish(new Engine(straight));
  assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.path,b.path);assert.deepEqual(a.trace,b.trace);
});
test('different seeds change slip while geometry remains finite',()=>{
  const a=finish(new Engine(straight)),b=finish(new Engine(straight,{...defaultProfile,seed:79}));
  assert.notEqual(a.heading,b.heading);assert.ok(Number.isFinite(a.distance));
});
test('pause does not advance physics or timers',()=>{
  const e=new Engine(straight);e.start();for(let i=0;i<50;i++)e.step();e.state='paused';const before=e.snapshot();for(let i=0;i<200;i++)e.step();assert.deepEqual(e.snapshot(),before);
});
test('wall contact does not freeze motor encoders',()=>{
  const e=finish(new Engine(straight,ideal,{x:0,y:450,heading:0}));assert.equal(e.state,'finished');assert.ok(e.y<=471.5);assert.ok(Math.abs(e.motors.A.position)>=360);assert.ok(e.distance<25);
});
test('yaw reset changes sensor reference without changing physical heading',()=>{
  const p=program({go:block('flippersensors_resetYaw')});const e=finish(new Engine(p,ideal,{x:0,y:0,heading:63}));assert.equal(e.heading,63);assert.equal(e.yaw,0);
});
test('unknown reachable blocks are rejected; unused unsupported routines are reported',()=>{
  const p=program({go:block('unknown_block')});const e=finish(new Engine(p));assert.equal(e.state,'error');assert.match(e.error,/unknown_block/);
  const unused={targets:[{blocks:{...straight.targets[0].blocks,loose:block('flippersensors_distance')}}]};assert.deepEqual(inspect(unused).unsupported,[]);assert.deepEqual(inspect(unused).unusedUnsupported,['flippersensors_distance']);
});
test('empty repeat-until loop yields and is stopped by simulated timeout',()=>{
  const p=program({go:block('control_repeat_until',{CONDITION:input(0)})});const e=finish(new Engine(p));assert.equal(e.state,'error');assert.match(e.error,/180/);assert.ok(e.time<=180+DT*2);
});
test('physical mismatch creates systematic heading error',()=>{
  const clean=finish(new Engine(straight,ideal,{x:0,y:0,heading:0}));const asymmetric=finish(new Engine(straight,{...ideal,mismatch:6},{x:0,y:0,heading:0}));assert.ok(Math.abs(asymmetric.heading-clean.heading)>4);
});
test('supplied 202-block program executes its custom blocks and completes',()=>{
  const p=JSON.parse(readFileSync(new URL('../../static/samples/new-code-blocks.json',import.meta.url)));const report=inspect(p);assert.equal(report.total,202);assert.equal(report.procedures.size,7);assert.deepEqual(report.unsupported,[]);
  const e=finish(new Engine(p));assert.equal(e.state,'finished',e.error);assert.ok(e.trace.some(x=>x.calls.some(v=>v.includes('Drive For X'))));assert.ok(e.trace.some(x=>x.calls.some(v=>v.includes('CELEBRATION'))));assert.ok(e.distance>1000);assert.ok(Number.isFinite(wrap(e.heading)));
  console.log('Sample:',JSON.stringify({seconds:e.time,events:e.trace.length,distanceMm:Math.round(e.distance)}));
});
