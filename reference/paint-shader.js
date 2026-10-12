// Paint shader from the prototype: sweep transition + 17 procedural patterns.
// Port into a material factory (e.g. src/three/materials/paint.ts). Injected into MeshPhysicalMaterial via onBeforeCompile.
// Pattern ids: 0 none,1 twin stripes,2 two-tone,3 honeycomb,4 digital camo,5 chevron,6 pinstripe,7 jaali,8 seigaiha,9 arabesque,10 aurora,
// 11 carbon weave,12 wood grain,13 brushed metal,14 quilt diamond,15 quilt hex,16 channels,17 perforated.
// NOTE: lin(hex) = new THREE.Color(hex).convertSRGBToLinear() in three r128; in modern three use ColorManagement instead.

const VHEAD = 'varying vec3 vLP; varying vec3 vLN; varying vec3 vWP; varying vec3 vWN;\n';
const FHEAD = `
uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uPCA; uniform vec3 uPCB;
uniform float uPatA; uniform float uPatB; uniform float uProg; uniform float uScale;
uniform vec3 uEdge; uniform float uChroma; uniform vec3 uChromaCol; uniform float uMin; uniform float uMax;
varying vec3 vLP; varying vec3 vLN; varying vec3 vWP; varying vec3 vWN;
vec3 gGlow;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnz(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hsh(i),hsh(i+vec2(1.0,0.0)),f.x), mix(hsh(i+vec2(0.0,1.0)),hsh(i+vec2(1.0,1.0)),f.x), f.y); }
float hexD(vec2 q){ vec2 r=vec2(1.0,1.7320508); vec2 h=r*0.5; vec2 a=mod(q,r)-h; vec2 b=mod(q-h,r)-h; vec2 g = dot(a,a)<dot(b,b)?a:b; g=abs(g); return max(dot(g, vec2(0.5,0.8660254)), g.x); }
float patMask(float id, vec3 p, vec3 n){
  if(id < 0.5) return 0.0;
  vec2 uv = abs(n.y) > 0.6 ? p.xz : (abs(n.x) > 0.6 ? p.zy : p.xy);
  uv *= uScale;
  if(id < 1.5){ float s=abs(p.z); float w=0.075*uScale; return 1.0 - smoothstep(w-0.008, w, abs(s-0.2)); }
  if(id < 2.5){ float yl = 0.48 + 0.12*uScale; return 1.0 - smoothstep(yl-0.008, yl+0.008, p.y); }
  if(id < 3.5){ return smoothstep(0.43, 0.47, hexD(uv*5.0)); }
  if(id < 4.5){ float h1=hsh(floor(uv*9.0)); float h2=hsh(floor(uv*4.5)+7.3); return max(step(0.66,h1), step(0.72,h2)); }
  if(id < 5.5){ float v=fract(uv.x*2.2 + abs(fract(uv.y*2.2)-0.5)); return smoothstep(0.48,0.5,v)*(1.0-smoothstep(0.78,0.8,v)); }
  if(id < 6.5){ float f=abs(fract(uv.y*9.0)-0.5); return smoothstep(0.44,0.47,f); }
  if(id < 7.5){ vec2 q=uv*4.5; float c1=abs(length(fract(q)-0.5)-0.36); float c2=abs(length(fract(q+0.5)-0.5)-0.36); return 1.0 - smoothstep(0.025,0.05,min(c1,c2)); }
  if(id < 8.5){ vec2 q=uv*vec2(4.0,6.0); float row=floor(q.y); q.x += mod(row,2.0)*0.5; vec2 f=vec2(fract(q.x)-0.5, fract(q.y)); float d=length(f)*1.6; float ring=abs(fract(d*3.0)-0.5); return (1.0-smoothstep(0.12,0.2,ring))*step(d,1.0); }
  if(id < 9.5){ vec2 g=fract(uv*3.5)-0.5; float sq=max(abs(g.x),abs(g.y)); float di=(abs(g.x)+abs(g.y))*0.70710678; float st=min(sq,di); return max(1.0-smoothstep(0.018,0.036,abs(st-0.3)), 1.0-smoothstep(0.012,0.028,abs(st-0.16))); }
  if(id < 10.5){ float w=sin(uv.x*1.6 + sin(uv.y*2.4 + uv.x*0.8)*1.6 + vnz(uv*1.3)*2.0); return smoothstep(0.2,0.9,w)*0.9; }
  if(id < 11.5){ vec2 c=uv*22.0; float chk=mod(floor(c.x)+floor(c.y),2.0); float fib = chk>0.5 ? fract(c.x) : fract(c.y); return mix(0.15,0.75,chk)*(0.6+0.4*sin(fib*3.14159)); }
  if(id < 12.5){ float g=sin((uv.x*1.5 + vnz(uv*vec2(1.2,6.0))*1.8)*18.0); return 0.5+0.5*g; }
  if(id < 13.5){ return hsh(vec2(floor(uv.y*260.0), floor(uv.x*1.5)))*0.6; }
  if(id < 14.5){ vec2 r=vec2(uv.x-uv.y, uv.x+uv.y)*0.70710678*7.0; vec2 f=abs(fract(r)-0.5); float e=0.5-max(f.x,f.y); return 1.0 - smoothstep(0.012,0.035,e); }
  if(id < 15.5){ return smoothstep(0.455, 0.485, hexD(uv*9.0)); }
  if(id < 16.5){ float f=abs(fract(uv.x*8.0)-0.5); return smoothstep(0.445,0.48,f); }
  if(id < 17.5){ vec2 g=fract(uv*22.0)-0.5; return 1.0 - smoothstep(0.14,0.2,length(g)); }
  return 0.0;
}
vec3 shadeC(vec3 col, float id, vec3 pc){ return mix(col, pc, clamp(patMask(id, vLP, normalize(vLN)),0.0,1.0)); }
`;
const FDIFF = `
float ax = vLP.x + vLP.y*0.35;
float tpos = mix(uMin, uMax, uProg);
float dd = ax - tpos;
float rev = 1.0 - smoothstep(-0.02, 0.02, dd);
vec3 baseC = mix(shadeC(uColA, uPatA, uPCA), shadeC(uColB, uPatB, uPCB), rev);
if(uChroma > 0.001){ float fr = 1.0 - abs(dot(normalize(cameraPosition - vWP), normalize(vWN))); fr = smoothstep(0.05, 0.9, fr); baseC = mix(baseC, uChromaCol, fr*uChroma); }
float act = step(0.0005, uProg)*step(uProg, 0.9995);
gGlow = uEdge * (1.0 - smoothstep(0.0, 0.09, abs(dd))) * act;
vec4 diffuseColor = vec4( baseC, opacity );
`;
function paintUniforms(o){
  return { uColA:{value:lin(o.color)}, uColB:{value:lin(o.color)}, uPCA:{value:lin(o.pc||'#000000')}, uPCB:{value:lin(o.pc||'#000000')},
    uPatA:{value:o.pat||0}, uPatB:{value:o.pat||0}, uProg:{value:0}, uScale:{value:o.scale||1}, uEdge:{value:new THREE.Color(2.2,1.7,1.1)},
    uChroma:{value:0}, uChromaCol:{value:new THREE.Color(0,0,0)}, uMin:{value:o.min!=null?o.min:-3.2}, uMax:{value:o.max!=null?o.max:3.3} };
}
function makePaint(o, sharedU){
  const u = sharedU || paintUniforms(o);
  const m = new THREE.MeshPhysicalMaterial({color:0xffffff, roughness:o.r!=null?o.r:.3, metalness:o.m!=null?o.m:.5, clearcoat:o.cc!=null?o.cc:1, clearcoatRoughness:.05, envMapIntensity:o.env||1.15, transparent:!!o.transparent});
  m.userData.u = u;
  m.onBeforeCompile = function(sh){
    const uu = this.userData.u; for(const k in uu) sh.uniforms[k]=uu[k];
    sh.vertexShader = VHEAD + sh.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\n vLP = position; vLN = normal;')
      .replace('#include <project_vertex>','#include <project_vertex>\n vWP = (modelMatrix*vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = FHEAD + sh.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', FDIFF)
      .replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = emissive + gGlow;');
  };
  return m;
}
function commitU(u){ u.uColA.value.copy(u.uColB.value); u.uPCA.value.copy(u.uPCB.value); u.uPatA.value=u.uPatB.value; u.uProg.value=0; }
function sweepTo(u, {col, pat, pc}, sweep=true, dur=1.6){
  if(u._tw){ u._tw.progress(1); u._tw=null; }
  u.uColB.value.copy(lin(col)); u.uPCB.value.copy(lin(pc)); u.uPatB.value = pat;
  if(!sweep || RM){ commitU(u); return; }
  u.uProg.value = 0;
  u._tw = gsap.to(u.uProg, {value:1, duration:dur, ease:'power2.inOut', onComplete:()=>{ commitU(u); u._tw=null; }});
}
