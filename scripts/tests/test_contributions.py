from copy import deepcopy
import unittest
from test_evidence_report import m, FixtureAPI, commit, CONFIG, REPO, SHA


class ContributionTests(unittest.TestCase):
    def test_lines_are_summed_by_commit_author_not_pr_author(self):
        api = FixtureAPI()
        api.commits = [commit(), commit(sha='b' * 40, login='bob')]
        api.pr['commits'] = 2
        report = m.collect(api, REPO, CONFIG, 1)
        rows = {row['identity']: row for row in report['contributions']}
        self.assertEqual(rows['alice']['lines_added'], 5)
        self.assertEqual(rows['bob']['lines_added'], 5)
        self.assertEqual(rows['bob']['lines_deleted'], 2)
        self.assertNotIn('hours', report)
        self.assertNotIn('Horas de trabajo', m.markdown(report))

    def test_aliases_aggregate_both_commits_and_lines(self):
        api = FixtureAPI()
        api.commits = [commit(), commit(sha='b' * 40, login='alice-old')]
        config = deepcopy(CONFIG);config['login_aliases'] = {'alice-old': 'alice'}
        api.pr['commits'] = 2
        rows = m.collect(api, REPO, config, 1)['contributions']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['non_merge_commits'], 2)
        self.assertEqual(rows[0]['lines_added'], 10)
        self.assertEqual(rows[0]['lines_deleted'], 4)

    def test_merges_are_counted_separately_without_duplicating_lines(self):
        api = FixtureAPI()
        merge = commit(sha='b' * 40);merge['parents'] = [{}, {}]
        api.commits = [commit(), merge];api.pr['commits'] = 2
        report = m.collect(api, REPO, CONFIG, 1)
        row = report['contributions'][0]
        self.assertEqual(row['non_merge_commits'], 1)
        self.assertEqual(row['merge_commits'], 1)
        self.assertEqual(row['lines_added'], 5)
        self.assertFalse(any(path.endswith('/commits/' + 'b' * 40) for path in api.calls))

    def test_missing_stats_remain_unknown_with_observed_subtotal(self):
        class PartialAPI(FixtureAPI):
            def get(self, path):
                if path.endswith('/commits/' + 'b' * 40):
                    raise m.Unavailable('HTTP 403')
                return super().get(path)
        api = PartialAPI();api.commits = [commit(), commit(sha='b' * 40)];api.pr['commits'] = 2
        row = m.collect(api, REPO, CONFIG, 1)['contributions'][0]
        self.assertIsNone(row['lines_added'])
        self.assertEqual(row['observed_lines_added'], 5)
        self.assertEqual(row['commits_with_line_stats'], 1)
        self.assertEqual(row['line_stats_status'], 'parcial')

    def test_zero_changes_are_distinct_from_missing_data(self):
        class EmptyStatsAPI(FixtureAPI):
            def get(self, path):
                result = super().get(path)
                if path.endswith('/commits/' + SHA):result['stats'] = {'additions': 0, 'deletions': 0}
                return result
        row = m.collect(EmptyStatsAPI(), REPO, CONFIG, 1)['contributions'][0]
        self.assertEqual(row['lines_added'], 0)
        self.assertEqual(row['line_stats_status'], 'disponible')

    def test_invalid_or_mismatched_stats_are_rejected(self):
        for stats in [None, {}, {'additions': -1, 'deletions': 0}, {'additions': True, 'deletions': 0}, {'additions': '5', 'deletions': 0}]:
            self.assertIsNone(m.valid_line_stats({'sha': SHA, 'stats': stats}, SHA))
        self.assertIsNone(m.valid_line_stats({'sha': 'b' * 40, 'stats': {'additions': 5, 'deletions': 0}}, SHA))

    def test_duplicates_do_not_multiply_lines_or_api_calls(self):
        api = FixtureAPI();api.commits = [commit(), commit()];api.pr['commits'] = 2
        row = m.collect(api, REPO, CONFIG, 1)['contributions'][0]
        self.assertEqual(row['lines_added'], 5)
        self.assertEqual(api.calls.count(f'repos/{REPO}/commits/{SHA}'), 1)

    def test_bots_and_unknown_authors_stay_separate(self):
        api = FixtureAPI();api.commits = [commit(login='dependabot[bot]'), commit(sha='b' * 40, login=None)];api.pr['commits'] = 2
        rows = m.collect(api, REPO, CONFIG, 1)['contributions']
        self.assertEqual({r['kind'] for r in rows}, {'bot', 'identidad pendiente'})

    def test_sums_are_churn_not_pr_net_diff_or_grade(self):
        api = FixtureAPI();api.commits = [commit(), commit(sha='b' * 40)];api.pr['commits'] = 2
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(report['contributions'][0]['lines_added'], 10)
        self.assertEqual(report['pr']['additions'], 5)
        rendered = m.markdown(report)
        self.assertIn('No miden tiempo, calidad, esfuerzo ni desempeño', rendered)
        self.assertIn('cambios textuales', rendered)

    def test_missing_all_stats_is_displayed_as_unknown(self):
        api = FixtureAPI();api.fail = {'/commits/' + SHA}
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertIsNone(report['contributions'][0]['lines_added'])
        self.assertIn('N/D', m.markdown(report))
        self.assertIn('parcial', report['sources']['line-stats'])

    def test_commit_patch_and_file_content_are_not_saved(self):
        class PatchAPI(FixtureAPI):
            def get(self, path):
                result = super().get(path)
                if path.endswith('/commits/' + SHA):
                    result['files'] = [{'filename': 'private.txt', 'patch': 'NEVER_STORE_PATCH'}]
                return result
        import json
        report = m.collect(PatchAPI(), REPO, CONFIG, 1)
        self.assertNotIn('NEVER_STORE_PATCH', json.dumps(report))
        self.assertNotIn('private.txt', json.dumps(report))

    def test_only_merges_have_no_line_total(self):
        api = FixtureAPI();api.commits[0]['parents'] = [{}, {}]
        report = m.collect(api, REPO, CONFIG, 1)
        row = report['contributions'][0]
        self.assertEqual(row['non_merge_commits'], 0)
        self.assertEqual(row['merge_commits'], 1)
        self.assertIsNone(row['lines_added'])
        self.assertEqual(row['line_stats_status'], 'no aplica: solo merges')


if __name__ == '__main__':
    unittest.main()
