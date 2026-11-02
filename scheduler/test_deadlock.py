import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parent
SOURCE = ROOT / 'deadlock.c'

class BankerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.binary = Path(cls.temp.name) / ('deadlock.exe' if __import__('os').name == 'nt' else 'deadlock')
        compiler = shutil.which('gcc') or shutil.which('clang')
        if not compiler:
            raise unittest.SkipTest('A C compiler (gcc/clang) is required.')
        subprocess.run([compiler, '-std=c11', '-O2', '-Wall', '-Wextra', '-pedantic', str(SOURCE), '-o', str(cls.binary)], check=True)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'temp'):
            cls.temp.cleanup()

    def run_banker(self, data):
        result = subprocess.run([str(self.binary)], input=data, text=True, capture_output=True, timeout=3, check=True)
        return json.loads(result.stdout)

    def test_classic_safe_sequence(self):
        data = '5 3\n3 3 2\n1 0 1 0 7 5 3\n2 2 0 0 3 2 2\n3 3 0 2 9 0 2\n4 2 1 1 2 2 2\n5 0 0 2 4 3 3\n'
        result = self.run_banker(data)
        self.assertTrue(result['safe'])
        self.assertEqual(result['safeSequence'], [2, 4, 5, 1, 3])

    def test_unsafe_state(self):
        data = '2 1\n0\n1 1 2\n2 0 1\n'
        result = self.run_banker(data)
        self.assertFalse(result['safe'])
        self.assertEqual(result['safeSequence'], [])

    def test_rejects_invalid_matrix(self):
        with self.assertRaises(subprocess.CalledProcessError):
            subprocess.run([str(self.binary)], input='1 1\n1\n1 2 1\n', text=True, capture_output=True, timeout=3, check=True)

if __name__ == '__main__':
    unittest.main()
