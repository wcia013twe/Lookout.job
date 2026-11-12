export const avatarIds=['alfred','iggy','felipe','todd','jojo'];
export const circleThemes=[
 {id:'cloud-cottage',name:'Cloud cottage',credit:'Lookout',background:'/circles/cloud-cottage.webp',ambience:'moon',palette:{accent:'#9c8fd4'},positions:[{station:{x:25,y:40},aisle:{x:31,y:48},rest:{x:33,y:62}},{station:{x:85,y:67},aisle:{x:75,y:65},rest:{x:68,y:64}},{station:{x:73,y:41},aisle:{x:65,y:48},rest:{x:60,y:48}},{station:{x:22,y:64},aisle:{x:30,y:65},rest:{x:44,y:69}},{station:{x:50,y:54},aisle:{x:53,y:58},rest:{x:54,y:61}}]},
 {id:'lamplit-cottage',name:'Lamplit cottage',credit:'Lookout · warm palette variant',background:'/circles/cloud-cottage.webp',ambience:'warm',palette:{accent:'#d7b579'},positions:[{station:{x:25,y:40},aisle:{x:31,y:48},rest:{x:33,y:62}},{station:{x:85,y:67},aisle:{x:75,y:65},rest:{x:68,y:64}},{station:{x:73,y:41},aisle:{x:65,y:48},rest:{x:60,y:48}},{station:{x:22,y:64},aisle:{x:30,y:65},rest:{x:44,y:69}},{station:{x:50,y:54},aisle:{x:53,y:58},rest:{x:54,y:61}}]},
];
export function circleTheme(id){return circleThemes.find(theme=>theme.id===id)||circleThemes[0];}
export function validateCircleAvatar(avatar){
 if(!avatar||typeof avatar!=='object'||Array.isArray(avatar))throw Error('Avatar required.');
 if(avatar.kind==='builtin'&&avatarIds.includes(avatar.id)&&Object.keys(avatar).every(key=>['kind','id'].includes(key)))return;
 if(!['image','sheet'].includes(avatar.kind)||Object.keys(avatar).some(key=>!['kind','dataUrl'].includes(key))||typeof avatar.dataUrl!=='string'||avatar.dataUrl.length>175000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(avatar.dataUrl))throw Error('Choose a transparent PNG up to 128 KB.');
 const bytes=Uint8Array.from(atob(avatar.dataUrl.slice(22)),character=>character.charCodeAt(0));
 if(bytes.length<33||bytes.length>131072||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw Error('Invalid PNG.');
 const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
 if(![4,6].includes(bytes[25])||(avatar.kind==='sheet'?(width!==768||height!==624):(width<1||width>512||height<1||height>512)))throw Error('Invalid avatar geometry or missing alpha channel.');
}
