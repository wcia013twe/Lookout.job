export async function searchLocations(text,{key,signal,request=fetch}){
 if(!key||text.trim().length<2)return [];
 const groups=await Promise.all(['country','city'].map(async type=>{
  const url=new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.search=new URLSearchParams({text:text.trim(),type,format:'json',limit:'5',lang:'en',apiKey:key}).toString();
  const response=await request(url,{signal,redirect:'error'});
  if(!response.ok)throw Error('Location search is unavailable. You can still enter a location.');
  const body=await response.json();
  if(!Array.isArray(body.results))throw Error('Location search is unavailable. You can still enter a location.');
  return body.results.map(row=>type==='country'?row.country:[row.city||row.name,row.state,row.country].filter(Boolean).join(', ')).filter(value=>typeof value==='string'&&value.trim());
 }));
 return [...new Set(groups.flat())];
}
