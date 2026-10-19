"""Publish an explicit allowlist of real local runs; never run during web/API startup.

Run with ml-service/.venv/Scripts/python.exe scripts/build_showcase.py.
Optional SHOWCASE_API_URL and SHOWCASE_SESSION_TOKEN target an authenticated local API.
No privileged credentials, reviewer identities, raw stock or private exports are copied.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import unicodedata
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import pymupdf
import requests
from PIL import Image
from rapidfuzz.fuzz import partial_ratio

ROOT = Path(__file__).resolve().parents[1]
STORAGE = (ROOT / "storage").resolve()
PUBLIC = ROOT / "frontend/public"
API = os.environ.get("SHOWCASE_API_URL", "http://localhost:8081").rstrip("/")
SESSION = requests.Session()
if os.environ.get("SHOWCASE_SESSION_TOKEN"):
    SESSION.headers["Authorization"] = "Bearer " + os.environ["SHOWCASE_SESSION_TOKEN"]

CASES = [
    {
        "paperId": "P-0003",
        "slug": "metabolic-health",
        "topic": "Metabolic health over time",
        "title": "Beyond the weight label",
        "year": 2018,
        "journal": "Diabetologia",
        "authors": "Matthias B. Schulze",
        "doi": "10.1007/s00125-018-4787-8",
        "summary": "C-0003-007",
        "note": "Published online in December 2018; volume 62 (2019), pages 558–566. The pipeline citation retains its recorded online year.",
        "review": "demonstration",
    },
    {
        "paperId": "P-0004",
        "slug": "glp1-and-appetite",
        "topic": "GLP-1 biology & appetite",
        "title": "A closer look at the gut signal",
        "year": 2016,
        "journal": "Nutrition & Metabolism",
        "authors": "Alexandra M. Bodnaruc, Denis Prud’homme, Rosanne Blanchet and Isabelle Giroux",
        "doi": "10.1186/s12986-016-0153-3",
        "summary": "C-0004-001",
        "note": "Narrative review, 2016. Bibliographic authors and year checked against the original PDF; extraction metadata is not treated as authoritative.",
        "review": "demonstration",
    },
    {
        "paperId": "P-0005",
        "slug": "muscle-preservation",
        "topic": "Muscle during weight management",
        "title": "What the scale leaves out",
        "year": 2021,
        "journal": "Nutrients",
        "authors": "David McCarthy and Aloys Berg",
        "doi": "10.3390/nu13072473",
        "summary": "C-0005-001",
        "note": "Narrative review, Nutrients 13(7), 2473 (2021). Publication year checked against the original PDF because the extracted year was missing.",
        "review": "demonstration",
    },
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_text(text: str) -> str:
    return re.sub(
        r"\s+", " ", unicodedata.normalize("NFKC", text).replace("-\n", "")
    ).strip()


def get(path: str):
    response = SESSION.get(API + path, timeout=60)
    response.raise_for_status()
    return response.json()


def stored(relative: str) -> Path:
    path = (STORAGE / relative.replace("\\", "/")).resolve()
    if not path.is_relative_to(STORAGE) or not path.is_file():
        raise ValueError("Missing or unsafe source artifact")
    return path


def file_info(path: Path, label: str) -> dict:
    result = {
        "url": "/" + path.relative_to(PUBLIC).as_posix(),
        "label": label,
        "sha256": digest(path),
        "bytes": path.stat().st_size,
    }
    if path.suffix.lower() in (".png", ".webp"):
        with Image.open(path) as image:
            result.update(width=image.width, height=image.height)
    return result


def vtt_stamp(ms: float) -> str:
    value = round(ms)
    return f"{value // 3600000:02}:{value // 60000 % 60:02}:{value // 1000 % 60:02}.{value % 1000:03}"


def public_reel(pid: str, scenes: list, citation: str) -> Path:
    """Replace the draft's mixed audio with original TTS, retaining its draft watermark.

    A real pipeline-rendered draft must be saved before Gate 2 removes its watermark.
    No generated copy, video frames, source mappings or timestamps are fabricated.
    """
    draft = ROOT / ".cache/showcase/draft-reels" / (pid + ".mp4")
    if not draft.is_file():
        raise ValueError(
            pid + ": save the genuine pipeline draft before final asset approval"
        )
    target = STORAGE / "renders" / (pid + "-showcase") / "reel.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    signature = hashlib.sha256(
        json.dumps(
            {
                "scenes": scenes,
                "citation": citation,
                "originalDraft": digest(draft),
                "musicSrc": None,
                "adaptationVersion": 2,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    marker = target.with_suffix(".showcase.json")
    if not (
        target.exists()
        and marker.exists()
        and json.loads(marker.read_text())["input"] == signature
    ):
        print(
            pid, "preparing music-free public adaptation from genuine draft", flush=True
        )
        ffmpeg = (
            ROOT
            / "render-service/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"
        )
        command = [str(ffmpeg), "-y", "-v", "error", "-i", str(draft)]
        filters = []
        offset = 0.0
        for i, scene in enumerate(scenes):
            command += ["-i", str(stored(scene.get("audioSrc") or scene["mp3Path"]))]
            filters.append(f"[{i + 1}:a]adelay={round(offset)}:all=1[a{i}]")
            offset += math.ceil((scene["durationMs"] + 200) / 1000 * 30) / 30 * 1000
        filters.append(
            "".join(f"[a{i}]" for i in range(len(scenes)))
            + f"amix=inputs={len(scenes)}:normalize=0,apad=whole_dur={(offset + 1000) / 1000}[voice]"
        )
        command += [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "0:v:0",
            "-map",
            "[voice]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-t",
            str((offset + 1000) / 1000),
            "-movflags",
            "+faststart",
            str(target),
        ]
        subprocess.run(command, check=True)
        marker.write_text(
            json.dumps({"input": signature, "sha256": digest(target)}), encoding="utf-8"
        )
    return target


def publish(config: dict) -> dict:
    pid = config["paperId"]
    detail = get("/api/papers/" + pid)
    raw_claims = get("/api/papers/" + pid + "/claims")
    raw_assets = get("/api/papers/" + pid + "/assets")
    passages = get("/api/papers/" + pid + "/passages")
    if detail["status"] != "EXPORTED" or len(raw_assets) != 4:
        raise ValueError(
            pid + ": complete both real backend gates and export before publication"
        )
    assert {a["type"] for a in raw_assets} == {"CAROUSEL", "STATIC", "CAPTION", "REEL"}
    passage_keys = [
        "passageId",
        "page",
        "section",
        "text",
        "bbox",
        "pageWidth",
        "pageHeight",
    ]
    passages = [{k: p.get(k) for k in passage_keys} for p in passages]
    by_passage = {p["passageId"]: p for p in passages}
    claims = []
    omitted = []
    pdf_document = pymupdf.open(stored("papers/" + pid + ".pdf"))
    used_claims = {key for a in raw_assets for key in a["claimIds"]}
    for original in raw_claims:
        keys = [
            "claimId",
            "scientificClaim",
            "consumerDraft",
            "quote",
            "quoteScore",
            "numbersOk",
            "entailment",
            "risk",
            "riskReason",
            "populationFit",
            "populationReason",
            "population",
            "studyDesign",
            "findingClass",
            "limitations",
            "doctorStatus",
            "reviewedAt",
        ]
        claim = {k: original.get(k) for k in keys}
        claim["approvedCopy"] = original.get("editedCopy")
        claim["evidence"] = by_passage[original["passage"]["passageId"]]
        claim["reviewNote"] = (
            original.get("doctorNote") if config["review"] == "demonstration" else None
        )
        claim["reproducedQuoteScore"] = round(
            partial_ratio(claim["quote"], claim["evidence"]["text"]), 2
        )
        if claim["reproducedQuoteScore"] < 90:
            raise ValueError(
                claim["claimId"] + ": quotation no longer matches original passage"
            )
        evidence = claim["evidence"]
        box = evidence["bbox"]
        page = pdf_document[evidence["page"] - 1]
        quote = source_text(claim["quote"])
        clipped = source_text(
            page.get_text(
                clip=pymupdf.Rect(
                    box["l"] - 1, box["t"] - 1, box["r"] + 1, box["b"] + 1
                )
            )
        )
        claim["independentPageScore"] = round(
            partial_ratio(quote, source_text(page.get_text())), 2
        )
        claim["independentRegionScore"] = round(partial_ratio(quote, clipped), 2)
        if (
            min(claim["independentPageScore"], claim["independentRegionScore"]) < 90
            or len(clipped) < len(quote) * 0.9
        ):
            if claim["claimId"] in used_claims or claim["doctorStatus"] != "REJECTED":
                raise ValueError(
                    claim["claimId"]
                    + ": used/approved claim does not match its recorded PDF region; publication blocked"
                )
            omitted.append(
                {
                    "claimId": claim["claimId"],
                    "reason": "Rejected, unused archive record omitted: quotation could not be independently confirmed within its recorded PDF page and Docling region.",
                }
            )
            continue
        claims.append(claim)
    pdf_document.close()
    # Publish only the original passage records attached to the curated, spatially checked claims.
    selected_passages = {c["evidence"]["passageId"] for c in claims}
    passages = [p for p in passages if p["passageId"] in selected_passages]
    claim_map = {c["claimId"]: c for c in claims}
    version = hashlib.sha256(
        json.dumps({"claims": claims, "assets": raw_assets}, sort_keys=True).encode()
    ).hexdigest()[:12]
    directory = PUBLIC / "showcase/media" / config["slug"] / version
    directory.mkdir(parents=True, exist_ok=True)

    def copy(relative: str, name: str, label: str) -> dict:
        target = directory / name
        shutil.copyfile(stored(relative), target)
        return file_info(target, label)

    pdf = copy("papers/" + pid + ".pdf", "source.pdf", "Original CC BY 4.0 paper")
    pages = []
    for page in sorted({c["evidence"]["page"] for c in claims}):
        target = directory / f"page-{page}.webp"
        if not target.exists():
            with Image.open(stored(f"pages/{pid}/{page}.png")) as image:
                image.save(target, "WEBP", quality=88, method=6)
        info = file_info(target, "Source page")
        pages.append(
            {
                "page": page,
                "url": info["url"],
                "width": info["width"],
                "height": info["height"],
                "sha256": info["sha256"],
                "bytes": info["bytes"],
            }
        )
    assets = []
    for raw in sorted(
        raw_assets,
        key=lambda a: ["CAROUSEL", "STATIC", "CAPTION", "REEL"].index(a["type"]),
    ):
        content = raw["content"]
        asset = {
            k: raw.get(k)
            for k in ["assetId", "type", "status", "version", "approvedAt"]
        }
        asset.update(
            blocks=[],
            media=[],
            hashtags=[],
            subtitleUrl=None,
            credits=[],
            adaptations=[],
            violations=[
                {
                    k: v.get(k)
                    for k in ["rule", "severity", "detail", "resolved", "location"]
                }
                for v in raw["violations"]
            ],
        )
        eligible = raw["status"] == "APPROVED" and all(
            claim_map[c]["doctorStatus"] in ("APPROVED", "EDITED")
            for c in raw["claimIds"]
        )
        if not eligible:
            raise ValueError(raw["assetId"] + ": backend approval gate not satisfied")
        for key in raw["claimIds"]:
            c = claim_map[key]
            if not (
                c["numbersOk"]
                and c["entailment"] == "SUPPORTED"
                and c["quoteScore"] >= 90
            ):
                eligible = False
        if raw["type"] == "CAROUSEL":
            for s in content["slides"]:
                highlights = []
                for b in content.get("blocks", []):
                    if b.get("slide") == s["n"]:
                        mapping = content.get("blockMap", {}).get(b["blockId"], {})
                        highlights.append(
                            {
                                **{k: b[k] for k in ["blockId", "x", "y", "w", "h"]},
                                "claimIds": mapping.get("claimIds", []),
                            }
                        )
                asset["blocks"].append(
                    {
                        "key": str(s["n"]),
                        "label": "Slide " + str(s["n"]),
                        "headline": s["headline"],
                        "body": s.get("body", ""),
                        "kind": s["kind"],
                        "claimIds": s["claimIds"],
                        "highlights": highlights,
                    }
                )
            for i, path in enumerate(raw["renderUrls"]):
                asset["media"].append(
                    copy(path, f"carousel-{i + 1}.png", f"Carousel slide {i + 1}")
                )
        elif raw["type"] == "STATIC":
            asset["blocks"] = [
                {
                    "key": "static",
                    "label": "Static post",
                    "headline": content["headline"],
                    "body": content["support"],
                    "kind": content["kind"],
                    "claimIds": content["claimIds"],
                }
            ]
            for i, path in enumerate(raw["renderUrls"]):
                asset["media"].append(copy(path, f"static-{i + 1}.png", "Static post"))
        elif raw["type"] == "CAPTION":
            asset["blocks"] = [
                {
                    "key": str(i),
                    "label": f"Paragraph {i + 1}",
                    "headline": "",
                    "body": p["text"],
                    "kind": p["kind"],
                    "claimIds": p["claimIds"],
                }
                for i, p in enumerate(content["paragraphs"])
            ]
            asset["hashtags"] = ["#" + h.lstrip("#") for h in content["hashtags"]]
        elif raw["type"] == "REEL":
            scenes = content["scenes"]
            source = public_reel(
                pid,
                scenes,
                content.get("citation")
                or f"{config['authors']}, {config['year']} · {config['journal']}",
            )
            target = directory / "reel.mp4"
            if not target.exists():
                ffmpeg = (
                    ROOT
                    / "render-service/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"
                )
                subprocess.run(
                    [
                        str(ffmpeg),
                        "-y",
                        "-v",
                        "error",
                        "-i",
                        str(source),
                        "-vf",
                        "scale=720:-2",
                        "-c:v",
                        "libx264",
                        "-crf",
                        "27",
                        "-preset",
                        "fast",
                        "-threads",
                        "2",
                        "-c:a",
                        "aac",
                        "-b:a",
                        "96k",
                        "-movflags",
                        "+faststart",
                        str(target),
                    ],
                    check=True,
                )
            info = file_info(target, "Music-free draft reel")
            info.update(width=720, height=1280)
            asset["media"] = [info]
            offset = 0.0
            cues = ["WEBVTT", ""]
            for scene in scenes:
                asset["blocks"].append(
                    {
                        "key": str(scene["n"]),
                        "label": f"Scene {scene['n']}",
                        "headline": scene["onScreen"],
                        "body": scene["voiceover"],
                        "kind": scene["kind"],
                        "claimIds": scene["claimIds"],
                        "startMs": offset,
                        "durationMs": scene["durationMs"],
                    }
                )
                words = scene.get("words", [])
                if not words:
                    raise ValueError("Missing real subtitle timings")
                for i in range(0, len(words), 5):
                    chunk = words[i : i + 5]
                    cues += [
                        f"{vtt_stamp(offset + chunk[0]['startMs'])} --> {vtt_stamp(offset + chunk[-1]['endMs'])}",
                        " ".join(w["text"] for w in chunk),
                        "",
                    ]
                offset += math.ceil((scene["durationMs"] + 200) / 1000 * 30) / 30 * 1000
                if scene.get("url"):
                    asset["credits"].append(
                        {
                            "creator": scene.get("creator", ""),
                            "source": scene.get("source", ""),
                            "url": scene["url"],
                        }
                    )
            subtitle = directory / "reel.vtt"
            subtitle.write_text("\n".join(cues), encoding="utf-8")
            asset["subtitleUrl"] = file_info(subtitle, "English subtitles")["url"]
            asset["adaptations"] = [
                "Public adaptation from the genuine pipeline draft: mixed audio replaced by original scene voiceovers to omit unverified background music. Original draft watermark retained because clinician sign-off is not established; compressed to 720p. Copy, scene frames and original word timings retained."
            ]
        # Retain legacy provenance gaps, never manufacture links to make an old output look verified.
        legacy_gap = config["review"] == "recorded-unverified" and raw["type"] in (
            "STATIC",
            "CAROUSEL",
            "CAPTION",
            "REEL",
        )
        if legacy_gap:
            eligible = False
            asset["adaptations"].append(
                "Legacy artifact: contains uncited scientific-sounding context or a recorded policy override. Shown for inspection, excluded from sample asset downloads; it is not fully verified publishing copy."
            )
        for b in asset["blocks"]:
            if b["kind"] == "claim" and not b["claimIds"]:
                raise ValueError("Scientific copy missing provenance")
            for key in b["claimIds"]:
                if key not in claim_map:
                    raise ValueError("Dangling claim link")
        asset["downloadAllowed"] = eligible
        asset["availabilityNote"] = (
            "Recorded workspace approval; not established clinician approval. "
            + (
                "Educational sample download eligible."
                if eligible
                else "Inspection preview only; no publishing download."
            )
        )
        assets.append(asset)

    summary = claim_map[config["summary"]]
    result = {
        "slug": config["slug"],
        "topic": config["topic"],
        "title": config["title"],
        "summary": summary["consumerDraft"] or summary["scientificClaim"],
        "summaryClaimId": summary["claimId"],
        "snapshotAt": datetime.now(UTC).isoformat(),
        "snapshotVersion": version,
        "curation": {
            "originalClaimCount": len(raw_claims),
            "publishedClaimCount": len(claims),
            "omittedClaims": omitted,
            "passageSelection": "Original passages for the public claim selection. Long extracted context may span beyond the highlighted region; every published quotation is independently checked on its recorded PDF page and region. No page or box was reassigned.",
        },
        "paper": {
            "paperId": pid,
            "title": detail["title"],
            "authors": config["authors"],
            "year": config["year"],
            "journal": config["journal"],
            "doi": config["doi"],
            "sourceUrl": "https://doi.org/" + config["doi"],
            "pdfUrl": pdf["url"],
            "pdfSha256": pdf["sha256"],
            "pdfBytes": pdf["bytes"],
            "pageCount": len(list((STORAGE / "pages" / pid).glob("*.png"))),
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "metadataNote": config["note"],
            "pages": pages,
        },
        "review": {
            "kind": config["review"],
            "clinicianVerified": False,
            "description": (
                "An earlier workspace run had unverified reviewer credentials. Public preparation re-reviewed the scoped claims and regenerated assets using explicitly labeled demonstration automation, not a clinician."
                if pid == "P-0003"
                else "Reviews were performed by explicitly labeled showcase automation for demonstration, not by a clinician."
            ),
        },
        "claims": claims,
        "assets": assets,
        "passages": passages,
        "stages": [
            {
                k: s.get(k)
                for k in [
                    "stage",
                    "status",
                    "seconds",
                    "model",
                    "llmCalls",
                    "cacheHits",
                ]
            }
            for s in detail["stages"]
        ],
        "downloads": [],
    }
    archive = directory / "educational-sample.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "READ-ME.txt",
            f"SteerProof educational software demonstration. NOT clinician-approved medical advice or publishing clearance.\n{result['review']['description']}\n{config['authors']}. {detail['title']} ({config['year']}). https://doi.org/{config['doi']}\nArticle CC BY 4.0, unmodified source PDF. Page previews are format conversions.\nGenerated sample adaptations and original checks are described in evidence.json. Legacy uncited assets are excluded. No raw stock or unverified music included.\n",
        )
        z.write(directory / "source.pdf", "source.pdf")
        for a in assets:
            if not a["downloadAllowed"]:
                continue
            for m in a["media"]:
                path = PUBLIC / m["url"].lstrip("/")
                z.write(path, path.name)
            if a["subtitleUrl"]:
                path = PUBLIC / a["subtitleUrl"].lstrip("/")
                z.write(path, path.name)
            if a["type"] == "CAPTION":
                z.writestr(
                    "caption.txt",
                    "\n\n".join(b["body"] for b in a["blocks"])
                    + "\n\n"
                    + " ".join(a["hashtags"]),
                )
        z.writestr("evidence.json", json.dumps(result, ensure_ascii=False, indent=2))
    result["downloads"] = [
        file_info(
            archive,
            "Educational samples & evidence"
            if any(a["downloadAllowed"] for a in assets)
            else "Original source & evidence only (legacy assets excluded)",
        )
    ]
    print(
        pid,
        len(claims),
        "claims;",
        sum(len(a["media"]) for a in assets),
        "media files;",
        version,
        flush=True,
    )
    return result


def main():
    cases = [publish(c) for c in CASES]
    target = ROOT / "frontend/showcase/generated/cases.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("Published 3 sanitized snapshots. No deployment performed.")


if __name__ == "__main__":
    main()
