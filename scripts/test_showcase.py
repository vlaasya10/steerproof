"""Offline publication integrity checks against the shipped artifacts (no API/LLM)."""

import hashlib
import json
import re
import unicodedata
import unittest
import zipfile
from pathlib import Path

import pymupdf as fitz
from rapidfuzz.fuzz import partial_ratio

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend/public"
CASES = json.loads(
    (ROOT / "frontend/showcase/generated/cases.json").read_text(encoding="utf-8")
)


class ShowcaseTest(unittest.TestCase):
    def test_source_pdf_identity_and_preview_integrity(self):
        for case in CASES:
            paper = case["paper"]
            pdf = PUBLIC / paper["pdfUrl"].lstrip("/")
            self.assertEqual(
                hashlib.sha256(pdf.read_bytes()).hexdigest(), paper["pdfSha256"]
            )
            with fitz.open(pdf) as doc:
                self.assertEqual(len(doc), paper["pageCount"])
                text = "".join(page.get_text() for page in doc).lower()
                self.assertIn(paper["doi"].lower(), text)
                self.assertIn(
                    "creativecommons.org/licenses/by/4.0",
                    text.replace(" ", "").replace("\n", ""),
                )

                def normalized(value):
                    return re.sub(
                        r"\s+",
                        " ",
                        unicodedata.normalize("NFKC", value).replace("-\n", ""),
                    ).strip()

                for claim in case["claims"]:
                    evidence = claim["evidence"]
                    page = doc[evidence["page"] - 1]
                    b = evidence["bbox"]
                    quoted = normalized(claim["quote"])
                    region = normalized(
                        page.get_text(
                            clip=fitz.Rect(
                                b["l"] - 1, b["t"] - 1, b["r"] + 1, b["b"] + 1
                            )
                        )
                    )
                    self.assertGreaterEqual(
                        partial_ratio(quoted, normalized(page.get_text())),
                        90,
                        claim["claimId"],
                    )
                    self.assertGreaterEqual(
                        partial_ratio(quoted, region), 90, claim["claimId"]
                    )
                    self.assertGreaterEqual(
                        len(region), len(quoted) * 0.9, claim["claimId"]
                    )
            for page in paper["pages"]:
                p = PUBLIC / page["url"].lstrip("/")
                self.assertEqual(
                    hashlib.sha256(p.read_bytes()).hexdigest(), page["sha256"]
                )
                self.assertEqual(p.stat().st_size, page["bytes"])

    def test_three_genuine_distinct_sources_and_honest_reviews(self):
        self.assertEqual(len(CASES), 3)
        self.assertEqual(len({c["paper"]["doi"] for c in CASES}), 3)
        for case in CASES:
            self.assertFalse(case["review"]["clinicianVerified"])
            self.assertIn(
                case["review"]["kind"], ("demonstration", "recorded-unverified")
            )
            self.assertEqual(case["paper"]["license"], "CC BY 4.0")
            self.assertTrue(case["stages"])
            self.assertTrue(all(s["status"] == "DONE" for s in case["stages"]))

    def test_every_claim_has_original_passage_page_coordinates_and_checks(self):
        for case in CASES:
            passages = {p["passageId"]: p for p in case["passages"]}
            pages = {p["page"] for p in case["paper"]["pages"]}
            for claim in case["claims"]:
                p = claim["evidence"]
                self.assertEqual(passages[p["passageId"]], p)
                self.assertIn(p["page"], pages)
                score = partial_ratio(claim["quote"], p["text"])
                self.assertGreaterEqual(score, 90, claim["claimId"])
                self.assertAlmostEqual(round(score, 2), claim["reproducedQuoteScore"])
                self.assertTrue(
                    0 <= p["bbox"]["l"] < p["bbox"]["r"] <= p["pageWidth"] + 1
                )
                self.assertTrue(
                    0 <= p["bbox"]["t"] < p["bbox"]["b"] <= p["pageHeight"] + 1
                )
                for key in (
                    "risk",
                    "riskReason",
                    "populationFit",
                    "populationReason",
                    "numbersOk",
                    "entailment",
                ):
                    self.assertIsNotNone(claim[key])
                self.assertGreaterEqual(claim["independentPageScore"], 90)
                self.assertGreaterEqual(claim["independentRegionScore"], 90)
            self.assertEqual(
                case["curation"]["originalClaimCount"],
                len(case["claims"]) + len(case["curation"]["omittedClaims"]),
            )
            used = {
                key
                for a in case["assets"]
                for b in a["blocks"]
                for key in b["claimIds"]
            }
            self.assertFalse(
                used.intersection(
                    c["claimId"] for c in case["curation"]["omittedClaims"]
                )
            )

    def test_media_hashes_formats_captions_subtitles_and_download_gates(self):
        for case in CASES:
            claims = {c["claimId"]: c for c in case["claims"]}
            self.assertEqual(
                {a["type"] for a in case["assets"]},
                {"CAROUSEL", "STATIC", "CAPTION", "REEL"},
            )
            for asset in case["assets"]:
                self.assertEqual(asset["status"], "APPROVED")
                self.assertTrue(asset["blocks"])
                for block in asset["blocks"]:
                    if block["kind"] == "claim":
                        self.assertTrue(block["claimIds"])
                    for key in block["claimIds"]:
                        self.assertIn(key, claims)
                        self.assertIn(
                            claims[key]["doctorStatus"], ("APPROVED", "EDITED")
                        )
                        if asset["downloadAllowed"]:
                            self.assertTrue(claims[key]["numbersOk"])
                            self.assertEqual(claims[key]["entailment"], "SUPPORTED")
                            self.assertGreaterEqual(claims[key]["quoteScore"], 90)
                for media in asset["media"]:
                    p = PUBLIC / media["url"].lstrip("/")
                    self.assertTrue(p.is_file())
                    self.assertEqual(p.stat().st_size, media["bytes"])
                    self.assertEqual(
                        hashlib.sha256(p.read_bytes()).hexdigest(), media["sha256"]
                    )
                if asset["type"] == "REEL":
                    self.assertTrue(asset["media"])
                    text = (PUBLIC / asset["subtitleUrl"].lstrip("/")).read_text(
                        encoding="utf-8"
                    )
                    self.assertTrue(text.startswith("WEBVTT"))
                    self.assertGreater(len(re.findall("-->", text)), 5)
            for d in case["downloads"]:
                p = PUBLIC / d["url"].lstrip("/")
                self.assertEqual(
                    hashlib.sha256(p.read_bytes()).hexdigest(), d["sha256"]
                )
                with zipfile.ZipFile(p) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertIn("evidence.json", archive.namelist())
                    self.assertIn(
                        "NOT clinician-approved", archive.read("READ-ME.txt").decode()
                    )
                    self.assertFalse(
                        any(
                            n.startswith(("broll/", "audio/"))
                            for n in archive.namelist()
                        )
                    )

    def test_public_allowlist_excludes_private_fields_and_actual_secrets(self):
        forbidden = {
            "doctorName",
            "approvedBy",
            "password",
            "token",
            "mediaToken",
            "audioSrc",
            "mp3Path",
            "videoPath",
            "DB_PASSWORD",
            "GEMINI_API_KEY",
            "DEPLOYMENT_ACCESS_KEY",
        }

        def walk(value):
            if isinstance(value, dict):
                self.assertFalse(forbidden.intersection(value))
                for v in value.values():
                    walk(v)
            elif isinstance(value, list):
                for v in value:
                    walk(v)

        walk(CASES)
        data = json.dumps(CASES)
        self.assertNotIn("Laasya", data)
        self.assertNotIn("C:\\projects", data)
        # Compare actual local secrets without logging their values.
        env = ROOT / ".env"
        secrets = []
        if env.exists():
            for line in env.read_text(encoding="utf-8-sig").splitlines():
                key, sep, value = line.partition("=")
                if sep and any(s in key.upper() for s in ("KEY", "PASSWORD", "SECRET")):
                    value = value.strip().strip('"').strip("'")
                    if len(value) >= 12:
                        secrets.append(value.encode())
        for directory in (PUBLIC, ROOT / "frontend/.next-showcase-build/static"):
            if not directory.exists():
                continue
            for p in directory.rglob("*"):
                if p.is_file() and p.suffix in (
                    ".json",
                    ".txt",
                    ".js",
                    ".map",
                    ".html",
                    ".vtt",
                ):
                    content = p.read_bytes()
                    self.assertFalse(
                        any(s in content for s in secrets),
                        "Actual secret found in " + str(p.relative_to(ROOT)),
                    )


if __name__ == "__main__":
    unittest.main()
