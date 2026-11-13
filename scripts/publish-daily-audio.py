"""Add the native audio player to an edition after its MP3 is generated."""

import argparse
from pathlib import Path


def add_player(edition: Path) -> None:
    track = edition.with_suffix(".mp3").name
    audio = edition.parent / "audio" / track
    if not audio.is_file() or not audio.stat().st_size:
        raise ValueError(f"Missing audio: {audio}")

    page = edition.read_text(encoding="utf-8")
    if 'id="daily-audio"' in page:
        return

    before, closing_header, after = page.partition("</header>")
    if not closing_header or 'class="brand-block"' not in before:
        raise ValueError(f"Missing edition masthead: {edition}")

    player = f"""
<section id="daily-audio" aria-labelledby="daily-audio-title" style="max-width:420px;margin:1rem auto;text-align:center">
  <h2 id="daily-audio-title" style="font-size:1rem;margin:0 0 .5rem;color:#001b40">听每日必读</h2>
  <audio controls preload="none" aria-labelledby="daily-audio-title" style="width:100%">
    <source src="audio/{track}" type="audio/mpeg">
  </audio>
  <a href="audio/{track}" style="font-size:.85rem">打开 MP3</a>
</section>
"""
    edition.write_text(before + closing_header + player + after, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("editions", type=Path, nargs="+")
    for path in parser.parse_args().editions:
        add_player(path)
