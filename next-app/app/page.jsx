import Link from 'next/link';
export default function Home() {
  return <><h1 className="text-3xl font-bold">Job Signal Board</h1><p className="mt-4 max-w-prose text-board-muted">The React migration starts with the application profile. This isolated preview shares the live editor’s field schema. The existing board remains the deployed application.</p><Link className="mt-6 inline-block text-board-accent underline underline-offset-4" href="/profile/">Open profile preview</Link></>;
}
