/* Shared outreach content for the live board and React migration. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JB.outreachTemplates = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  return [
    {
      name: "Engineer you know",
      use: "Someone on the team you have talked to before.",
      body: `Hey [Name], saw you're on [Team] at [Company]. I'm applying for the [Title] role and your work on [specific thing] stood out. I did backend work at Goldman last summer and have an Oracle offer, but I'm looking for something more infra focused. Open to referring me? I can send my resume and the link. Thanks either way.`,
    },
    {
      name: "Engineer (cold)",
      use: "No prior contact, but the team is a strong fit.",
      body: `Hi [Name], I'm Wesley, new grad SWE. I found you while looking into [Team] at [Company]. I've been working on [relevant project or stack] and the [Title] post looks like a fit. Would you be open to a quick chat or a referral? Totally fine if not. I can send over details.`,
    },
    {
      name: "Recruiter",
      use: "Recruiter for the role, keep it short and direct.",
      body: `Hi [Name], I'm interested in the [Title] role at [Company] in [Location]. I'm a recent grad with SWE experience at Goldman and an Oracle offer, mostly backend and distributed systems. Is the team still hiring for this? Happy to send my resume and a short summary. Thanks, Wesley`,
    },
    {
      name: "Alum",
      use: "Shared school, weak tie.",
      body: `Hey [Name], fellow [School] grad here. I'm applying for [Title] at [Company] and saw you joined [Team] last year. Most of my work has been backend at Goldman and Oracle. Would you be comfortable with a referral? I'll make it easy on my end.`,
    },
    {
      name: "Former coworker",
      use: "Worked together before, shared context.",
      body: `Hey [Name], we worked together on [project or team] at [Company]. I'm applying for [Title] at [NewCompany] and it lines up with the backend work we did. Would you be open to referring me? I can send my resume and the posting. Appreciate it.`,
    },
    {
      name: "Friend",
      use: "Low pressure ask.",
      body: `Hey [Name], quick favor. I'm applying for [Title] at [Company]. Any chance you could refer me? Happy to send everything you need. No pressure at all.`,
    },
    {
      name: "Networking first touch",
      use: "No ask yet, just start the conversation.",
      body: `Hi [Name], I'm Wesley, new grad SWE focused on backend and distributed systems. I saw your team at [Company] is working on [thing]. Would you be open to a 15 min chat about the work? Trying to learn more about the space.`,
    },
    {
      name: "After a chat: referral ask",
      use: "Follow up once they know you.",
      body: `Hi [Name], thanks for the chat, the part about [detail] was really helpful. I'm applying for the [Title] role on your team. Would you be comfortable referring me? I can send my resume and the link.`,
    },
    {
      name: "Thank you",
      use: "Send within a day of the referral.",
      body: `Hi [Name], just wanted to say thanks for the referral for [Title] at [Company]. Really appreciate you putting your name behind me. I'll keep you posted on how it goes.`,
    },
    {
      name: "Bump",
      use: "One nudge after 5 to 7 days, same thread.",
      body: `Hi [Name], bumping this in case it got buried. Still interested in the [Title] role at [Company] if you're open to referring me. Happy to send my resume and link. Thanks!`,
    },
  ];
});
