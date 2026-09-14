import argparse
import json
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


INVALID_XML_CHARS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")


def parse_args():
    parser = argparse.ArgumentParser(description="Crop question regions from a CAIE Paper 1 PDF.")
    parser.add_argument("--pdf", required=True, help="Path to the question paper PDF.")
    parser.add_argument("--out", default="server/storage/crop-experiments", help="Output directory.")
    parser.add_argument("--slug", default=None, help="Output folder name. Defaults to the PDF stem.")
    parser.add_argument("--questions", default="1,2,3,4,5", help="Comma-separated question numbers to export.")
    parser.add_argument("--dpi", type=int, default=220, help="Render DPI for output crops.")
    parser.add_argument("--total", type=int, default=40, help="Total questions in the paper.")
    return parser.parse_args()


def require_tool(name):
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"{name} was not found on PATH")
    return path


def run_pdftotext(pdf_path):
    pdftotext = require_tool("pdftotext")
    result = subprocess.run(
        [pdftotext, "-bbox", str(pdf_path), "-"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.stdout


def tag_name(element):
    return element.tag.rsplit("}", 1)[-1]


def parse_pages(bbox_html, total_questions):
    bbox_html = INVALID_XML_CHARS.sub("", bbox_html)
    root = ET.fromstring(bbox_html)
    pages = []

    for page_index, page in enumerate((node for node in root.iter() if tag_name(node) == "page"), start=1):
        page_width = float(page.attrib["width"])
        page_height = float(page.attrib["height"])
        words = []

        for word in (node for node in page.iter() if tag_name(node) == "word"):
            text = "".join(word.itertext()).strip()
            if not text:
                continue
            words.append(
                {
                    "text": text,
                    "x0": float(word.attrib["xMin"]),
                    "y0": float(word.attrib["yMin"]),
                    "x1": float(word.attrib["xMax"]),
                    "y1": float(word.attrib["yMax"]),
                }
            )

        starts = []
        for word in words:
            if not word["text"].isdigit():
                continue
            question = int(word["text"])
            if question < 1 or question > total_questions:
                continue
            if 34 <= word["x0"] <= 64 and word["y0"] >= 45:
                starts.append({ "question": question, **word })

        starts.sort(key=lambda item: item["y0"])
        pages.append(
            {
                "page": page_index,
                "width": page_width,
                "height": page_height,
                "words": words,
                "starts": starts,
            }
        )

    return pages


def build_crops(pages, selected_questions):
    crops = []

    for page in pages:
        starts = page["starts"]
        for index, start in enumerate(starts):
            question = start["question"]
            if question not in selected_questions:
                continue

            next_start = starts[index + 1] if index + 1 < len(starts) else None
            y0 = max(36, start["y0"] - 9)
            if next_start:
                y1 = next_start["y0"] - 11
            else:
                y1 = infer_last_question_bottom(page, start)

            if y1 <= y0 + 24:
                continue

            crops.append(
                {
                    "question": question,
                    "page": page["page"],
                    "box": {
                        "x0": 38,
                        "y0": round(y0, 2),
                        "x1": page["width"] - 34,
                        "y1": round(y1, 2),
                    },
                }
            )

    return crops


def infer_last_question_bottom(page, start):
    content_words = [
        word for word in page["words"]
        if word["y0"] >= start["y0"] - 1 and word["x0"] >= 66 and word["y0"] < page["height"] - 26
    ]
    if not content_words:
        return page["height"] - 38

    lines = []
    for word in sorted(content_words, key=lambda item: item["y0"]):
        if not lines or abs(word["y0"] - lines[-1]["y0"]) > 3.5:
            lines.append({ "y0": word["y0"], "y1": word["y1"] })
        else:
            lines[-1]["y1"] = max(lines[-1]["y1"], word["y1"])

    previous = lines[0]
    for line in lines[1:]:
        gap = line["y0"] - previous["y1"]
        if previous["y0"] > start["y0"] + 45 and gap > 88:
            return min(previous["y1"] + 24, page["height"] - 38)
        previous = line

    return min(lines[-1]["y1"] + 24, page["height"] - 38)


def render_page(pdf_path, page_number, dpi, temp_dir):
    pdftoppm = require_tool("pdftoppm")
    prefix = temp_dir / f"page-{page_number}"
    subprocess.run(
        [
            pdftoppm,
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-r",
            str(dpi),
            "-png",
            str(pdf_path),
            str(prefix),
        ],
        check=True,
        capture_output=True,
    )

    matches = sorted(temp_dir.glob(f"page-{page_number}-*.png"))
    if not matches:
        raise RuntimeError(f"pdftoppm did not produce an image for page {page_number}")
    return matches[0]


def crop_to_png(page_png, crop, dpi, output_path):
    scale = dpi / 72
    box = crop["box"]
    pixel_box = tuple(round(box[key] * scale) for key in ("x0", "y0", "x1", "y1"))

    with Image.open(page_png) as image:
        image.crop(pixel_box).save(output_path)

    return pixel_box


def main():
    args = parse_args()
    pdf_path = Path(args.pdf).resolve()
    selected_questions = {int(part.strip()) for part in args.questions.split(",") if part.strip()}
    out_dir = Path(args.out).resolve() / (args.slug or pdf_path.stem)
    out_dir.mkdir(parents=True, exist_ok=True)

    bbox_html = run_pdftotext(pdf_path)
    pages = parse_pages(bbox_html, args.total)
    crops = build_crops(pages, selected_questions)

    manifest = {
        "pdf": str(pdf_path),
        "dpi": args.dpi,
        "requestedQuestions": sorted(selected_questions),
        "detectedQuestions": [crop["question"] for crop in crops],
        "crops": [],
    }

    with tempfile.TemporaryDirectory() as temp_name:
        temp_dir = Path(temp_name)
        rendered_pages = {}

        for crop in crops:
            page_number = crop["page"]
            if page_number not in rendered_pages:
                rendered_pages[page_number] = render_page(pdf_path, page_number, args.dpi, temp_dir)

            filename = f"q{crop['question']:02d}_page{page_number}.png"
            output_path = out_dir / filename
            pixel_box = crop_to_png(rendered_pages[page_number], crop, args.dpi, output_path)
            manifest["crops"].append(
                {
                    **crop,
                    "pixelBox": pixel_box,
                    "file": str(output_path),
                }
            )

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({ "manifest": str(manifest_path), "count": len(manifest["crops"]) }, indent=2))


if __name__ == "__main__":
    main()
