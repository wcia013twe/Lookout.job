// Local composer previews only. This module never uploads or persists bytes.
export const circleFileAccept='.png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx';
const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',md:'text/markdown',csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function localCircleFile(file){
 const extension=file.name?.split('.').at(-1)?.toLowerCase(),mime=types[extension];
 if(!mime)throw Error('Choose an image, PDF, Word, text, spreadsheet or presentation file.');
 if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>10*1024*1024)throw Error('Choose a nonempty file up to 10 MB.');
 if(file.type&&file.type!==mime&&!(extension==='md'&&file.type==='text/plain')&&file.type!=='application/octet-stream')throw Error('The file type does not match its extension. Choose another file.');
 return {name:file.name.slice(0,200),mime,bytes:file.size,kind:mime.startsWith('image/')?'image':'document',extension};
}
export function fileSizeLabel(bytes){return bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.ceil(bytes/1024)} KB`:`${(bytes/(1024*1024)).toFixed(1)} MB`;}
