"""Add the native audio player to an edition after its MP3 is generated."""

import argparse
from hashlib import sha256
import re
from pathlib import Path


PLAYER_SCRIPT = '<script src="../daily-audio.js?v=20261124-1" defer></script>'


def upgrade_player(page: str) -> str:
    if 'id="daily-audio-track"' not in page or 'src="../daily-audio.js?' in page:
        return page
    pattern = r"<script>\s*\(\(\) => \{\s*const audio = document\.getElementById\('daily-audio-track'\);[\s\S]*?</script>"
    upgraded, count = re.subn(pattern, lambda _: PLAYER_SCRIPT, page, count=1)
    if count != 1:
        raise ValueError("Unrecognized daily player controller; preserve page for review")
    return upgraded


def add_player(edition: Path) -> None:
    track = edition.with_suffix(".mp3").name
    audio = edition.parent / "audio" / track
    if not audio.is_file() or not audio.stat().st_size:
        raise ValueError(f"Missing audio: {audio}")

    page = upgrade_player(edition.read_text(encoding="utf-8"))
    if 'id="daily-audio"' in page:
        version = sha256(audio.read_bytes()).hexdigest()[:12]
        page, count = re.subn(
            r'(<audio id="daily-audio-track"[^>]*? src=")[^"]+',
            lambda match: match[1] + f"audio/{track}?v={version}",
            page,
            count=1,
        )
        if count == 0:
            page, count = re.subn(
                r'(<source\s+src=")audio/[^"]+',
                lambda match: match[1] + f"audio/{track}?v={version}",
                page,
                count=1,
            )
        if count != 1:
            raise ValueError(f"Missing edition audio source: {edition}")
        edition.write_text(page, encoding="utf-8")
        return

    before, closing_header, after = page.partition("</header>")
    if not closing_header or 'class="brand-block"' not in before:
        raise ValueError(f"Missing edition masthead: {edition}")

    player = f"""
<section id="daily-audio" aria-labelledby="daily-audio-title" style="max-width:420px;margin:1rem auto;text-align:center">
  <h2 id="daily-audio-title" style="font-size:1rem;margin:0 0 .5rem;color:#001b40">听每日必读</h2>
  <button type="button" id="daily-audio-toggle" aria-pressed="false">听新闻</button>
  <audio id="daily-audio-track" controls preload="metadata" aria-labelledby="daily-audio-title" style="width:100%">
    <source src="audio/{track}" type="audio/mpeg">
  </audio>
  <a href="audio/{track}" style="font-size:.85rem">打开 MP3</a>
</section>
{PLAYER_SCRIPT}
"""
    edition.write_text(before + closing_header + player + after, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("editions", type=Path, nargs="+")
    for path in parser.parse_args().editions:
        add_player(path)
