// Expand only an explicitly selected engineering family; negative rules still win.
export function expandTitleAliases(filter) {
 if(!Array.isArray(filter?.positive)||!filter.positive.length)return filter;
 const aliases=new Set(filter.positive);
 const add=values=>values.forEach(value=>aliases.add(value));
 for(const keyword of filter.positive){
  if(/^(software engineer|software engineering)$/i.test(keyword))add(['Software Development Engineer','Software Dev Engineer','Software Developer','word:SDE','Full Stack Engineer','Full-Stack Engineer','Fullstack Engineer','Frontend Engineer','Front End Engineer','Front-End Engineer']);
  if(/^(backend|backend engineer)$/i.test(keyword))add(['Backend Developer','Back End Engineer','Back-End Engineer','Back End Developer','Back-End Developer']);
 }
 return {...filter,positive:[...aliases]};
}
