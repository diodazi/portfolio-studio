// Fisher–Yates with an unbiased integer draw; no random comparator sorting.
export function randomInt(max){
  if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;do{crypto.getRandomValues(value)}while(value[0]>=limit);return value[0]%max}
  return Math.floor(Math.random()*max);
}
export function shuffle(items,draw=randomInt){const result=[...items];for(let i=result.length-1;i>0;i--){const j=draw(i+1);[result[i],result[j]]=[result[j],result[i]]}return result}
export function createPhotoDeck(items,{draw=randomInt,previous=[]}={}){
  const unique=items.filter((item,i,a)=>a.findIndex(x=>x.id===item.id)===i);let queue=[],last=[...previous];
  function refill(avoid){const shuffled=shuffle(unique,draw),ids=new Set(avoid);queue=[...shuffled.filter(p=>!ids.has(p.id)),...shuffled.filter(p=>ids.has(p.id))]}
  return {next(limit=6){
    const selected=[];while(selected.length<Math.min(limit,unique.length)){
      if(!queue.length)refill([...last,...selected.map(p=>p.id)]);
      const item=queue.shift();if(!selected.some(p=>p.id===item.id))selected.push(item);
    }
    // The same small collection should not reappear in precisely the same order.
    if(selected.length>1&&selected.every((p,i)=>p.id===last[i]))selected.push(selected.shift());
    last=selected.map(p=>p.id);return selected;
  }};
}
export function photoRatio(photo){const ratio=Number(photo.width)/Number(photo.height);return Number.isFinite(ratio)&&ratio>0?ratio:1}
// Six positions in a single composition, with a focal image and small edge overlaps.
export const COLLAGE_SLOTS=[
  [90,145,535,395,2,-.8], [845,115,255,380,3,1.2],
  [575,25,255,190,4,1], [650,405,265,205,5,-1],
  [190,505,270,165,4,1.1], [25,40,215,155,5,-1.4]
];
export function composePhotos(items,variant=0){
  if(items.length<2)return [...items];
  const slots=COLLAGE_SLOTS.slice(0,items.length);let best=[...items],bestCost=Infinity;
  function search(remaining,placed,cost){
    if(cost>=bestCost)return;
    if(!remaining.length){best=placed;bestCost=cost;return}
    const i=placed.length,slot=slots[i],target=slot[2]/slot[3];
    remaining.forEach((photo,index)=>{
      const fit=Math.abs(Math.log(photoRatio(photo)/target));
      search(remaining.filter((_,j)=>index!==j),[...placed,photo],cost+fit*(i===0?1.6:1));
    });
  }
  // The shuffle provides tie order, so equally suited images retain variety.
  const candidates=[...items];if(variant%2)candidates.reverse();search(candidates,[],0);return best;
}
export function collageGeometry(items,width,height,{variant=0,mobile=false}={}){
  const mobileSlots=[[18,125,285,265,2,-.8],[224,360,158,244,3,1],[38,570,250,180,4,-1],[208,780,170,175,5,1],[18,805,160,135,3,-1],[255,20,125,140,4,1]];
  let slots=mobile?mobileSlots:COLLAGE_SLOTS;
  if(items.length===1)slots=mobile?[[35,150,330,600,2,0]]:[[190,60,820,560,2,0]];
  if(items.length===2)slots=mobile?[[20,80,280,350,2,-1],[100,490,280,350,3,1]]:[[100,100,540,450,2,-1],[660,180,430,400,3,1]];
  const refW=mobile?400:1200,refH=mobile?1000:700;
  return items.map((photo,i)=>{
    let [x,y,w,h,z,angle]=slots[i];
    if(variant%2&&!mobile)x=refW-x-w;
    const boxW=w*width/refW,boxH=h*height/refH,ratio=photoRatio(photo),drawW=Math.min(boxW,boxH*ratio),drawH=drawW/ratio;
    return {x:x*width/refW+(boxW-drawW)/2,y:y*height/refH+(boxH-drawH)/2,width:drawW,height:drawH,z,angle:variant%2?-angle:angle};
  });
}
