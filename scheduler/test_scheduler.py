import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parent
SOURCE = ROOT / 'scheduler.c'

class SchedulerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.binary = Path(cls.temp.name) / ('scheduler.exe' if os.name == 'nt' else 'scheduler')
        compiler = shutil.which('gcc') or shutil.which('clang')
        if not compiler:
            raise unittest.SkipTest('A C compiler (gcc/clang) is required.')
        subprocess.run([compiler, '-std=c11', '-O2', '-Wall', '-Wextra', '-pedantic', str(SOURCE), '-o', str(cls.binary)], check=True)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'temp'):
            cls.temp.cleanup()

    def run_scheduler(self, algorithm, processes, quantum=2):
        lines = [algorithm, str(len(processes))]
        if algorithm == 'RR': lines.append(str(quantum))
        lines.extend(f'{p[0]},{p[1]},{p[2]},{p[3]}' for p in processes)
        completed = subprocess.run([str(self.binary)], input='\n'.join(lines) + '\n', text=True,
                                   capture_output=True, timeout=3, check=True)
        return json.loads(completed.stdout)

    def test_fcfs_order_and_metrics(self):
        result = self.run_scheduler('FCFS', [(1, 0, 5, 2), (2, 1, 3, 1)])
        self.assertEqual([x['process'] for x in result['schedule']], [1, 2])
        self.assertEqual(result['results'][1]['waiting_time'], 4)

    def test_sjf_selects_shortest_ready_process(self):
        result = self.run_scheduler('SJF', [(1, 0, 8, 2), (2, 1, 2, 1), (3, 1, 3, 3)])
        self.assertEqual([x['process'] for x in result['schedule']], [1, 2, 3])

    def test_priority_selects_lowest_priority_number(self):
        result = self.run_scheduler('PRIORITY', [(1, 0, 5, 4), (2, 0, 2, 1)])
        self.assertEqual([x['process'] for x in result['schedule']], [2, 1])

    def test_round_robin_splits_processes(self):
        result = self.run_scheduler('RR', [(1, 0, 5, 2), (2, 1, 3, 1)], 2)
        self.assertGreater(len(result['schedule']), 2)
        self.assertEqual(result['results'][0]['completion_time'], 8)

    def test_idle_time_jumps_to_next_arrival(self):
        result = self.run_scheduler('SJF', [(1, 2_000_000_000, 2, 1)])
        self.assertEqual(result['schedule'][0]['start'], 2_000_000_000)

if __name__ == '__main__':
    unittest.main()
