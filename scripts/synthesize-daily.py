"""Generate a daily edition's MP3 with Azure Speech (requires lxml)."""

import argparse
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape

from lxml import html


def extract_sections(path):
    document = html.fromstring(path.read_text(encoding="utf-8"))
    for control in document.xpath("//button | //figure | //script | //style"):
        control.drop_tree()

    sections = []
    for title, selector in [
        ("今日焦点", "story"),
        ("今日扫描", "scan-item"),
        ("今日洞见", "view-title daily-view"),
    ]:
        match = " or ".join(
            f"contains(concat(' ', normalize-space(@class), ' '), ' {name} ')"
            for name in selector.split()
        )
        nodes = document.xpath(f"//*[{match}]")
        if not nodes:
            raise ValueError(f"{path}: missing {title}")
        sections.append([title + "。", *(" ".join(" ".join(node.itertext()).split()) for node in nodes)])
    return sections


def synthesize(sections, output):
    region = os.environ.get("AZURE_SPEECH_REGION", "")
    key = os.environ.get("AZURE_SPEECH_KEY")
    if not key or not re.fullmatch(r"[a-z0-9]+", region):
        raise SystemExit("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION before generating audio.")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temp:
        work = Path(temp)
        tracks = []
        for section in sections:
            for paragraph in section:
                if not paragraph:
                    continue
                ssml = (
                    '<speak version="1.0" xml:lang="zh-CN" xmlns="http://www.w3.org/2001/10/synthesis">'
                    '<voice name="zh-CN-YunyangNeural">' + escape(paragraph) + '</voice></speak>'
                )
                req = Request(
                    f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                    data=ssml.encode("utf-8"),
                    headers={
                        "Ocp-Apim-Subscription-Key": key,
                        "Content-Type": "application/ssml+xml",
                        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
                    },
                )
                track = work / f"{len(tracks):03}.mp3"
                with urlopen(req, timeout=60) as result:
                    track.write_bytes(result.read())
                tracks.append(track.name)

        playlist = work / "tracks.txt"
        playlist.write_text("".join(f"file {track}\n" for track in tracks))
        merged = work / "edition.mp3"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "concat", "-safe", "1", "-i",
             str(playlist.resolve()), "-c:a", "copy", str(merged.resolve())],
            check=True,
        )
        merged.replace(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("edition", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Print the narration without calling Azure.")
    args = parser.parse_args()
    sections = extract_sections(args.edition)
    if args.dry_run:
        print("\n\n".join("\n".join(section) for section in sections))
        return
    synthesize(sections, args.edition.parent / "audio" / args.edition.with_suffix(".mp3").name)


if __name__ == "__main__":
    main()
