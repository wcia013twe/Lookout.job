/* Single schema for the static editor and incremental React migration. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JB.profileSchema = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const scalarFields = ['name','firstName','lastName','preferredName','suffix','email','phone','birthday','location','address','address2','address3','postalCode','linkedin','github','portfolio','otherUrl','authorization','headline','currentEmployer','jobSearchStatus','skills','preferredSkills','languages'];
  const schemas = {
    workExperience: [['title','Job title','text','organization-title'],['company','Company','text','organization'],['location','Location','text','address-level2'],['employmentType','Employment type'],['startDate','Start date','month'],['endDate','End date','month'],['current','I currently work here','checkbox'],['description','Description','textarea']],
    education: [['school','School'],['degree','Degree'],['fieldOfStudy','Field of study'],['gpa','GPA'],['startDate','Start date','month'],['endDate','End date','month'],['description','Additional information','textarea']],
    projects: [['name','Project name'],['role','Role'],['url','Project URL','url'],['startDate','Start date','month'],['endDate','End date','month'],['description','Description','textarea']],
  };
  return {scalarFields,schemas};
});
