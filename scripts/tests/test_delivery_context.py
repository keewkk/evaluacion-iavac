from copy import deepcopy
from pathlib import Path
import sys
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from delivery_context import capture_context, resolution_event

REPO = 'example/course'


def event(merged=True):
    return {'action': 'closed', 'pull_request': {'number': 1, 'state': 'closed', 'merged': merged,
            'closed_at': '2026-10-09T12:00:00Z', 'merged_at': '2026-10-09T12:00:00Z' if merged else None,
            'base': {'ref': 'main'}, 'head': {'ref': 'desa', 'sha': 'a' * 40, 'repo': {'full_name': REPO}}}}


class DeliveryTests(unittest.TestCase):
    def test_resolution_closed_with_and_without_merge(self):
        for merged in [True, False]:
            self.assertTrue(resolution_event('pull_request', event(merged), REPO))

    def test_approval_open_sync_push_and_wrong_delivery_do_not_generate(self):
        for name in ['pull_request_review', 'push']:
            self.assertFalse(resolution_event(name, event(), REPO))
        for action in ['opened', 'synchronize', 'reopened']:
            data = event();data['action'] = action
            self.assertFalse(resolution_event('pull_request', data, REPO))
        data = event();data['pull_request']['base']['ref'] = 'desa'
        self.assertFalse(resolution_event('pull_request', data, REPO))
        data = event();data['pull_request']['head']['repo']['full_name'] = 'fork/course'
        self.assertFalse(resolution_event('pull_request', data, REPO))

    def test_context_separates_merge_and_unmerged_closure(self):
        report = {'pr': {'head_sha': 'a' * 40, 'state': 'closed'}}
        self.assertEqual(capture_context('pull_request', event(), report)['kind'], 'integrado')
        self.assertEqual(capture_context('pull_request', event(False), report)['kind'], 'cerrado sin integrar')
        report['pr']['head_sha'] = 'b' * 40
        self.assertFalse(capture_context('pull_request', event(), report)['head_matches_event'])

    def test_workflow_only_automatically_runs_on_closed(self):
        text = (SCRIPTS.parent / '.github/workflows/reporting.yml').read_text()
        self.assertIn('types: [closed]', text)
        self.assertNotIn('pull_request_review:', text)
        self.assertNotIn('  push:', text)
        self.assertIn("github.event.action == 'closed'", text)

    def test_manual_capture_is_explicit(self):
        self.assertTrue(resolution_event('workflow_dispatch', {}, REPO))
        self.assertEqual(capture_context('workflow_dispatch', {}, {})['kind'], 'recaptura manual')


if __name__ == '__main__':
    unittest.main()
