"""Prepare static sharing metadata for dated ImpactOne editions."""

import argparse
from html import escape, unescape
from pathlib import Path
import re
from urllib.parse import quote, urlsplit

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
STORY = re.compile(r'<article\s+class="story"[^>]*>(.*?)</article>', re.S)


def prepare_share(edition: Path) -> None:
    page = edition.read_text(encoding="utf-8")
    head, marker, body = page.partition("</head>")
    stories = STORY.findall(body)
    if not marker or len(stories) < 3:
        raise ValueError(f"Missing focus stories in {edition}")

    titles = []
    for story in stories[:3]:
        title = re.search(r"<h3[^>]*>(.*?)</h3>", story, re.S)
        if not title:
            raise ValueError(f"Missing focus headline in {edition}")
        titles.append(" ".join(unescape(re.sub(r"<[^>]+>", "", title[1])).split()))

    image = re.search(r'<img\b[^>]*\bsrc="([^"]+)"', stories[0])
    canonical = re.search(r'<link rel="canonical" href="(https://[^"]+)"', head)
    if not image or not canonical:
        raise ValueError(f"Missing focus image or canonical URL in {edition}")

    day = edition.stem
    thumbnail = ROOT / "images" / "daily" / f"share-{day}.jpg"
    source = (edition.parent / image[1]).resolve()
    with Image.open(source) as original:
        square = ImageOps.fit(original.convert("RGB"), (600, 600), Image.Resampling.LANCZOS)
        square.save(thumbnail, quality=87, optimize=True)

    image_url = f"https://{urlsplit(canonical[1]).netloc}/{quote(thumbnail.relative_to(ROOT).as_posix())}"
    description = "｜".join(f"{index}. {title}" for index, title in enumerate(titles, 1))
    tags = [
        ("name", "description", description),
        ("property", "og:description", description),
        ("property", "og:image", image_url),
        ("property", "og:image:type", "image/jpeg"),
        ("property", "og:image:width", "600"),
        ("property", "og:image:height", "600"),
        ("name", "twitter:image", image_url),
        ("name", "twitter:description", description),
    ]
    for attribute, key, _ in tags:
        head = re.sub(rf'(?m)^ *<meta {attribute}="{re.escape(key)}"[^>]*>\n', "", head)
    metadata = "\n".join(
        f'  <meta {attribute}="{key}" content="{escape(value, quote=True)}">'
        for attribute, key, value in tags
    )
    head = re.sub(r'(?m)^ *<link rel="image_src"[^>]*>\n', "", head)
    metadata += f'\n  <link rel="image_src" href="{escape(image_url, quote=True)}">'
    head = re.sub(r'(?m)^( *<meta property="og:url"[^>]*>)$', lambda m: f"{m[1]}\n{metadata}", head)
    edition.write_text(head + marker + body, encoding="utf-8")


    title = re.search(r'<meta property="og:title" content="([^"]+)"', head)
    if not title:
        raise ValueError(f"Missing card title in {edition}")
    entry = ROOT / "share" / edition.name
    entry.parent.mkdir(exist_ok=True)
    article = escape(unescape(canonical[1]), quote=True)
    entry_url = f"https://{urlsplit(canonical[1]).netloc}/share/{quote(entry.name)}"
    headlines = "\n".join(f"    <li>{escape(item)}</li>" for item in titles)
    entry.write_text(f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title[1]}</title>
  <meta name="robots" content="noindex">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{title[1]}">
  <meta property="og:url" content="{entry_url}">
{metadata}
  <style>
    body {{ margin: 0; background: #f7f7f5; color: #001b40; font: 17px/1.6 system-ui, sans-serif; }}
    main {{ max-width: 36rem; margin: auto; padding: 1.5rem; }}
    img {{ display: block; width: min(100%, 24rem); height: auto; border-radius: .5rem; }}
    h1 {{ font-size: 1.4rem; }}
    .read {{ display: inline-block; padding: .6rem 1rem; background: #001b40; color: white; border-radius: .3rem; }}
  </style>
</head>
<body>
<main>
  <a href="{article}"><img src="{image_url}" width="600" height="600" alt="{escape(titles[0], quote=True)}"></a>
  <h1>{title[1]}</h1>
  <ol>
{headlines}
  </ol>
  <a class="read" href="{article}">阅读本期全文</a>
</main>
</body>
</html>
""", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("editions", type=Path, nargs="+")
    for edition in parser.parse_args().editions:
        prepare_share(edition)
