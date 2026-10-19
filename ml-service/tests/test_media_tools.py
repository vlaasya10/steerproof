import shutil
import subprocess
from pathlib import Path

import pytest

from app.reel import audio
from app.reel.media_tools import media_executable


@pytest.mark.asyncio
async def test_audio_concatenation_with_spaces_and_apostrophes(monkeypatch, tmp_path: Path):
    try:
        ffmpeg = media_executable("ffmpeg")
    except RuntimeError:
        pytest.skip("Install render-service dependencies or FFmpeg for the media integration test")
    tone = tmp_path / "tone.mp3"
    subprocess.run([
        ffmpeg, "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
        "-t", "0.3", "-acodec", "libmp3lame", str(tone),
    ], check=True, capture_output=True)

    async def synthesize_fixture(*, out_mp3_path: Path, **kwargs):
        shutil.copyfile(tone, out_mp3_path)
        return 0.3, [{"text": "fixture", "startMs": 0, "endMs": 300}], False

    monkeypatch.setattr(audio, "synth_scene", synthesize_fixture)
    storage = tmp_path / "Laasya's media folder"
    result = await audio.generate_reel_audio(
        "A-9000-REEL", [{"n": 1}, {"n": 2}], storage,
    )
    assert (storage / result["audioPath"]).stat().st_size > 0
    assert result["totalDurationMs"] >= 600
    assert result["words"][1]["startMs"] == 300
