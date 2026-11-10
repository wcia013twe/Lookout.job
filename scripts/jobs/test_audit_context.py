import copy
import json
import tempfile
import unittest
from pathlib import Path
import audit


class ClockEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'receipts').mkdir()
        self.spec = {'stages': [{'id': 'first'}, {'id': 'second'}]}
        self.result = {'structuralIssues': [], 'limitations': ['old'] * 6,
                       'conditions': {c: {'reached': ['first', 'second'],
                           'hostObservations': [{'timing': {'monotonicSeconds': 3, 'valid': True}}] * 2}
                           for c in ['baseline', 'lookout']}}

    def preflight(self):
        p = self.root / 'receipts/clock.json'
        p.write_text(json.dumps({'aligned': True, 'stages': [{'stage': s['id']} for s in self.spec['stages']]}))
        gate = {'name': 'native_clock_alignment', 'path': str(p), 'status': 'passed', 'sha256': audit.digest(p)}
        (self.root / 'receipts/preflight.json').write_text(json.dumps({'host': {'gates': [gate]}}))
        return p

    def responses(self, count=2):
        for i in range(count):
            p = self.root / 'runs/lookout' / str(i)
            p.mkdir(parents=True)
            (p / 'response.json').write_text(json.dumps({'clock': {
                'aligned': True, 'clockMode': 'ticking_isolated_backend',
                'sqlNow': '2026-11-09T14:00:00Z', 'javascriptNow': '2026-11-09T14:00:00Z',
                'nodeApiNow': '2026-11-09T14:00:00Z'}}))

    def inspect(self):
        return audit.contextualize(self.root, copy.deepcopy(self.result), self.spec)

    def test_complete_bound_evidence_is_reported_without_quality_claim(self):
        self.preflight()
        self.responses()
        result = self.inspect()
        self.assertTrue(result['clockVerification']['sqlEdgeNodeProven'])
        self.assertEqual(result['structuralIssues'], [])
        self.assertEqual(result['conditions']['baseline']['semanticQuality'], 'not_assessed_by_structural_audit')

    def test_preflight_alone_cannot_prove_actual_turn_clocks(self):
        self.preflight()
        self.responses(1)
        result = self.inspect()
        self.assertFalse(result['clockVerification']['sqlEdgeNodeProven'])
        self.assertIn('complete actual-turn clock captures are unavailable', result['limitations'][1])

    def test_tampered_receipt_is_a_structural_issue(self):
        self.preflight().write_text('{}')
        result = self.inspect()
        self.assertEqual(result['clockVerification']['nativePreflight'], 'invalid_receipt')
        self.assertTrue(result['structuralIssues'])

    def test_missing_receipt_preserves_auditable_failure(self):
        self.preflight().unlink()
        result = self.inspect()
        self.assertEqual(result['clockVerification']['nativePreflight'], 'invalid_receipt')
        self.assertFalse(result['clockVerification']['sqlEdgeNodeProven'])

    def test_external_symlink_cannot_supply_clock_evidence(self):
        p = self.preflight()
        external = self.root / 'outside.json'
        external.write_bytes(p.read_bytes())
        p.unlink()
        p.symlink_to(external)
        self.assertEqual(self.inspect()['clockVerification']['nativePreflight'], 'invalid_receipt')

    def test_partial_timing_is_not_reported_as_complete(self):
        self.result['conditions']['baseline']['hostObservations'].pop()
        result = self.inspect()
        self.assertFalse(result['clockVerification']['monotonicReceiptsCapturedForBoth'])
        self.assertIn('unavailable', result['limitations'][2])

    def test_historical_missing_evidence_stays_unverified(self):
        result = self.inspect()
        self.assertEqual(result['clockVerification']['nativePreflight'], 'unavailable')
        self.assertFalse(result['clockVerification']['sqlEdgeNodeProven'])


if __name__ == '__main__':
    unittest.main()
