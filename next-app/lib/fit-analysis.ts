// Only explicit skill labels from the saved fit brief are safe to surface as matches.
// Older free-form briefs and malformed lists remain untouched and show no list.
export function readMatchingSkills(whyItFits = ''): {skills: string[]; narrative: string} {
  const match = whyItFits.match(/^Matching skills: ([^\r\n]+)\r?\n/);
  if (!match) return {skills: [], narrative: whyItFits};
  const labels = match[1].split(';').map(label => label.trim());
  if (labels.length < 1 || labels.length > 3 || labels.some(label => !/^[\p{L}\p{N}][\p{L}\p{N} .+#/&-]{0,39}$/u.test(label)) || new Set(labels.map(label => label.toLocaleLowerCase())).size !== labels.length) return {skills: [], narrative: whyItFits};
  return {skills: labels, narrative: whyItFits.slice(match[0].length)};
}
export const fitAnalysisLabels = ['Team', 'Your contribution', 'Your growth', 'Support', 'Practical fit'] as const;
export type FitAnalysisBullet = {label: typeof fitAnalysisLabels[number]; text: string};
// Plain text only: recognizes the saved labels, never invents missing sections.
export function parseFitAnalysis(whyItFits = '', materialGap = ''): {intro: string; bullets: FitAnalysisBullet[]} | null {
  const text = [readMatchingSkills(whyItFits).narrative, materialGap].filter(Boolean).join('\n').trim();
  const pattern = /(?:^|\s)(?:[-•*]\s*)?(Team|Your contribution|Your growth|Support|Practical fit):[ \t]*/g;
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== fitAnalysisLabels.length || matches.some((match, i) => match[1] !== fitAnalysisLabels[i])) return null;
  const bullets = matches.map((match, i) => ({label: fitAnalysisLabels[i], text: text.slice(match.index! + match[0].length, matches[i + 1]?.index ?? text.length).trim()}));
  if (bullets.some(bullet => !bullet.text)) return null;
  return {intro: text.slice(0, matches[0].index).trim(), bullets};
}
