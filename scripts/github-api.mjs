// GitHub automation never sends credentials to URLs supplied by a pull request.
export function githubApi(token, fetchImpl = fetch) {
  if (!token) throw Error('GitHub automation token is required');
  return async (method, path, body) => {
    if (!path.startsWith('/') || path.startsWith('//')) throw Error('Relative GitHub API path required');
    const response=await fetchImpl('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    const text=await response.text();
    const data=text?JSON.parse(text):null;
    if(!response.ok){const error=Error('GitHub API request rejected ('+response.status+')');error.status=response.status;throw error;}
    return data;
  };
}
export async function paginate(api,path,key) {
  const all=[];
  for(let page=1;page<=100;page++) {
    const data=await api('GET',path+(path.includes('?')?'&':'?')+'per_page=100&page='+page);
    const rows=key?data[key]:data;all.push(...rows);
    if(rows.length<100)return all;
  }
  throw Error('GitHub result exceeds bounded pagination');
}
