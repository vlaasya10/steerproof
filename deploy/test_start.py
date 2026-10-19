import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("startup", Path(__file__).with_name("start.py"))
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


class StartupTest(unittest.TestCase):
    def test_free_never_starts_heavy_processes_even_if_full_requested(self):
        for requested in ("auto", "api", "full"):
            self.assertEqual("api", startup.processing_mode(requested, 512, True))

    def test_full_pipeline_remains_available(self):
        self.assertEqual("full", startup.processing_mode("full", 4096, True))
        self.assertEqual("full", startup.processing_mode("auto", 4096, False))
        self.assertEqual("api", startup.processing_mode("auto", None, True))
        self.assertEqual("api", startup.processing_mode("api", 4096, False))
        with self.assertRaises(ValueError):
            startup.processing_mode("typo", 512, True)

    def test_api_command_opens_render_public_port_with_bounded_heap(self):
        command = startup.java_command("api", "12345")
        self.assertIn("--server.port=12345", command)
        self.assertIn("--server.address=0.0.0.0", command)
        self.assertIn("-Xmx160m", command)
        self.assertNotIn("node", command)


if __name__ == "__main__":
    unittest.main()
