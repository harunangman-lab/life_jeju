"""Compatibility entry point for the public Jeju Domin course snapshot."""
from pathlib import Path
import runpy
if __name__=="__main__":
    runpy.run_path(str(Path(__file__).with_name("update-domin.py")),run_name="__main__")
