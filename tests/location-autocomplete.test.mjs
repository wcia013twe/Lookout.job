import test from 'node:test';
import assert from 'node:assert/strict';
import {searchLocations} from '../next-app/lib/location-autocomplete.mjs';
test('location suggestions request both country and city, format and deduplicate',async()=>{
 const calls=[];
 const rows=await searchLocations('New',{key:'fictional',request:async url=>{
  calls.push(url);return {ok:true,json:async()=>({results:url.searchParams.get('type')==='country'?[{country:'New Zealand'}]:[{city:'New York',state:'New York',country:'United States'},{city:'New York',state:'New York',country:'United States'}]})};
 }});
 assert.deepEqual(rows,['New Zealand','New York, New York, United States']);
 assert.deepEqual(calls.map(url=>url.searchParams.get('type')),['country','city']);
 assert.ok(calls.every(url=>url.origin==='https://api.geoapify.com'&&url.searchParams.get('text')==='New'));
});
test('short input or absent configuration makes no vendor request',async()=>{
 const request=()=>{throw Error('unexpected request');};
 assert.deepEqual(await searchLocations('N',{key:'fictional',request}),[]);
 assert.deepEqual(await searchLocations('New',{request}),[]);
});
test('provider errors preserve a useful manual-entry fallback',async()=>{
 await assert.rejects(searchLocations('New',{key:'fictional',request:async()=>({ok:false})}),/still enter a location/);
});
