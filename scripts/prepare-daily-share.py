"""Prepare direct-reading daily sharing metadata and focus-first image fallback."""

import argparse
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import quote, urlsplit

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
STORY = re.compile(r'<article\s+class="story"[^>]*>(.*?)</article>', re.S)
DECORATION_CSS = '<style id="daily-share-decorations">canvas.io-share-decoration{display:block;width:100%;height:auto}</style>'

class ImageAttributes(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag == "img":
            self.attrs = dict(attrs)

def image_attributes(tag):
    parser = ImageAttributes()
    parser.feed(tag)
    return parser.attrs

def support_backgrounds(head):
    for selector in [".fixed-section-banner-0917 img", ".skyline-original img"]:
        head = head.replace(selector, selector.replace("img", ":is(img,canvas)"))
    if 'id="daily-share-decorations"' not in head:
        head = head.replace('<style>', DECORATION_CSS + '\n<style>', 1)
    return head

def decorative_background(tag, edition):
    attrs = image_attributes(tag)
    src = attrs.get("src", "")
    path = urlsplit(unescape(src)).path
    if not Path(path).name.startswith(("impactone-", "impactone.")):
        raise ValueError(f"Unexpected editorial image before focus one in {edition}: {src}")
    with Image.open((edition.parent / path).resolve()) as original:
        width, height = original.size
    label = attrs.get("alt", "")
    css = "background-image:url(\"" + src.replace('"', "%22") + "\");background-size:100% 100%;background-repeat:no-repeat;background-position:center"
    classes = (attrs.get("class", "") + " io-share-decoration").strip()
    accessibility = f'role="img" aria-label="{escape(label, quote=True)}"' if label else 'aria-hidden="true"'
    return f'<canvas data-share-decoration width="{width}" height="{height}" class="{escape(classes, quote=True)}" {accessibility} style="{escape(css, quote=True)}"></canvas>'

def prepare_share(edition):
    page = edition.read_text(encoding="utf-8")
    head, marker, body = page.partition("</head>")
    stories = STORY.findall(body)
    if not marker or len(stories) < 4:
        raise ValueError(f"Missing four focus stories in {edition}")
    titles = []
    for story in stories[:4]:
        title = re.search(r"<h3[^>]*>(.*?)</h3>", story, re.S)
        if not title:
            raise ValueError(f"Missing headline in {edition}")
        titles.append(" ".join(unescape(re.sub(r"<[^>]+>", "", title[1])).split()))
    image = re.search(r'<img\b[^>]*\bsrc="([^"]+)"', stories[0])
    canonical = re.search(r'<link rel="canonical" href="(https://[^"]+)"', head)
    if not image or not canonical:
        raise ValueError(f"Missing focus image or canonical URL in {edition}")
    source = (edition.parent / urlsplit(unescape(image[1])).path).resolve()
    with Image.open(source) as original:
        full = original.convert("RGB")
        if source.suffix.lower() not in (".jpg", ".jpeg"):
            jpeg = source.with_suffix(".jpg")
            full.save(jpeg, quality=92, optimize=True)
            jpeg_src = str(jpeg.relative_to(ROOT)).replace("\\", "/")
            jpeg_src = "../" + jpeg_src
            stories[0] = stories[0].replace(image[1], jpeg_src, 1)
            first = STORY.search(body)
            body = body[:first.start(1)] + stories[0] + body[first.end(1):]
        thumbnail = ROOT / "images" / "daily" / f"share-{edition.stem}.jpg"
        ImageOps.fit(full, (600, 600), Image.Resampling.LANCZOS).save(thumbnail, quality=87, optimize=True)
    first = STORY.search(body)
    prefix = re.sub(r"<img\b[^>]*>", lambda m: decorative_background(m[0], edition), body[:first.start()])
    body = prefix + body[first.start():]
    head = support_backgrounds(head)
    image_url = f"https://{urlsplit(canonical[1]).netloc}/{quote(thumbnail.relative_to(ROOT).as_posix())}"
    description = "｜".join(f"{index}. {title}" for index, title in enumerate(titles, 1))
    tags = [
        ("name", "impactone:share-url", unescape(canonical[1]) + "?share=focus4"),
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
    metadata = "\n".join(f'  <meta {attribute}="{key}" content="{escape(value, quote=True)}">' for attribute, key, value in tags)
    head = re.sub(r'(?m)^ *<link rel="image_src"[^>]*>\n', "", head)
    metadata += f'\n  <link rel="image_src" href="{escape(image_url, quote=True)}">'
    head = re.sub(r'(?m)^( *<meta property="og:url"[^>]*>)$', lambda m: f"{m[1]}\n{metadata}", head)
    edition.write_text(head + marker + body, encoding="utf-8")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("editions", type=Path, nargs="+")
    for edition in parser.parse_args().editions:
        prepare_share(edition)
