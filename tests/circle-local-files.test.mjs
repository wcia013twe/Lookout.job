import test from 'node:test';
import assert from 'node:assert/strict';
import {localCircleFile,fileSizeLabel,circleFileAccept} from '../next-app/lib/circle-local-files.mjs';
test('local composer file previews accept bounded images and documents without serializing bytes',()=>{
 assert.deepEqual(localCircleFile({name:'round-notes.PDF',type:'application/pdf',size:2048,privateBytes:'never copied'}),{name:'round-notes.PDF',mime:'application/pdf',bytes:2048,kind:'document',extension:'pdf'});
 assert.equal(localCircleFile({name:'whiteboard.png',type:'image/png',size:1024}).kind,'image');
 for(const extension of ['doc','docx','txt','md','csv','xlsx','pptx','jpg','jpeg','webp','gif'])assert.ok(localCircleFile({name:`context.${extension}`,type:'',size:100}));
 for(const file of [{name:'script.html',type:'text/html',size:100},{name:'payload.svg',type:'image/svg+xml',size:100},{name:'large.png',size:10485761},{name:'empty.pdf',size:0},{name:'wrong.pdf',type:'text/html',size:100}])assert.throws(()=>localCircleFile(file));
 assert.ok(circleFileAccept.includes('.pdf'));assert.equal(fileSizeLabel(100),'100 B');assert.equal(fileSizeLabel(2048),'2 KB');assert.equal(fileSizeLabel(1048576),'1.0 MB');
});
