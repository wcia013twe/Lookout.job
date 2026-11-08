export const fitAnalysisLabels = ['Team', 'Your contribution', 'Your growth', 'Support', 'Practical fit'] as const;
export type FitAnalysisBullet = {label: typeof fitAnalysisLabels[number]; text: string};
// Plain text only: recognizes the saved labels, never invents missing sections.
export function parseFitAnalysis(whyItFits = '', materialGap = ''): {intro: string; bullets: FitAnalysisBullet[]} | null {
  const text = [whyItFits, materialGap].filter(Boolean).join('\n').trim();
  const pattern = /(?:^|\s)(?:[-•*]\s*)?(Team|Your contribution|Your growth|Support|Practical fit):[ \t]*/g;
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== fitAnalysisLabels.length || matches.some((match, i) => match[1] !== fitAnalysisLabels[i])) return null;
  const bullets = matches.map((match, i) => ({label: fitAnalysisLabels[i], text: text.slice(match.index! + match[0].length, matches[i + 1]?.index ?? text.length).trim()}));
  if (bullets.some(bullet => !bullet.text)) return null;
  return {intro: text.slice(0, matches[0].index).trim(), bullets};
}
