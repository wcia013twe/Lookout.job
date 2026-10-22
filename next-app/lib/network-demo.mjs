import {demoFixtures as baseFixtures} from './demo.mjs';
import {demoOutreachContacts} from './outreach-demo.mjs';
import {emptyCompany,encodeCompany} from '../../lib/network-model.mjs';
// Two focused Network examples. Other product demos keep their own scenarios.
export function demoFixtures(date){
 const fixtures=baseFixtures(date);
 const companies=[
  {id:'dddddddd-1111-4111-8111-111111111111',revision:1,record:{...emptyCompany('Robinhood'),priority:'Apply Now',interest:'Fictional backend process: compare infrastructure ownership and mentorship with a return-offer path.',targetTeams:'Backend reliability',concerns:'Confirm exact team, on-call expectations and support for new engineers.',research:'Demo context only; the recruiter is checking team scope. These are not verified claims about Robinhood.',nextAction:'Follow up with Alex about preparation material and team scope',followUpDate:date,sources:[{title:'Fictional role brief',url:'https://example.com/demo/robinhood-role',observedAt:date,summary:'Demo source only: backend reliability and a project deep dive.'}]}},
  {id:'dddddddd-2222-4222-8222-222222222222',revision:1,record:{...emptyCompany('Stripe'),priority:'Strong Consider',interest:'Fictional referral conversation: investigate infrastructure work, onboarding support and early ownership.',targetTeams:'Infrastructure engineering',concerns:'Do not infer the team from the job title; verify systems versus integration scope.',research:'Demo context only; Jamie offered a referral and an introduction. These are not verified claims about Stripe.',nextAction:'Send Jamie two questions for the engineer introduction',sources:[{title:'Fictional role brief',url:'https://example.com/demo/stripe-role',observedAt:date,summary:'Illustrative infrastructure role; team and scope need confirmation.'}]}}
 ];
 fixtures.state.network.referrals=[...demoOutreachContacts(date),...companies.map(encodeCompany)];
 fixtures.state.network.people=[];
 return fixtures;
}
