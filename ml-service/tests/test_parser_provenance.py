import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pymupdf
import pytest
from app.parse import docling_parser


def test_docling_failure_is_reported_without_fallback(monkeypatch, tmp_path: Path):
    converter = Mock()
    converter.convert.side_effect = RuntimeError("layout model unavailable")
    monkeypatch.setattr(docling_parser, "DocumentConverter", lambda: converter)
    fallback = Mock(
        side_effect=AssertionError(
            "Must not substitute PDF text for Docling provenance"
        )
    )
    monkeypatch.setattr(pymupdf, "open", fallback)

    with pytest.raises(
        RuntimeError, match="Docling could not parse P-0001.*layout model unavailable"
    ):
        docling_parser.parse_pdf("paper.pdf", "P-0001", tmp_path)

    fallback.assert_not_called()
    assert not (tmp_path / "parsed" / "P-0001.json").exists()


def test_small_docling_result_preserves_provenance_and_replaces_legacy_cache(
    monkeypatch, tmp_path: Path
):
    cache = tmp_path / "parsed" / "P-0001.json"
    cache.parent.mkdir()
    cache.write_text(json.dumps([]), encoding="utf-8")
    bbox = SimpleNamespace(l=10, t=20, r=300, b=40)
    item = SimpleNamespace(
        label="paragraph",
        text="Evidence from a real Docling passage.",
        prov=[SimpleNamespace(page_no=1, bbox=bbox)],
    )
    document = SimpleNamespace(
        pages={1: SimpleNamespace(size=SimpleNamespace(width=600, height=800))},
        iterate_items=lambda: [(item, 0)],
    )
    converter = Mock()
    converter.convert.return_value = SimpleNamespace(document=document)
    monkeypatch.setattr(docling_parser, "DocumentConverter", lambda: converter)
    pdf = tmp_path / "paper.pdf"
    with pymupdf.open() as document_pdf:
        document_pdf.new_page(width=600, height=800)
        document_pdf.save(pdf)

    passages = docling_parser.parse_pdf(str(pdf), "P-0001", tmp_path)
    assert len(passages) == 1
    assert passages[0].page == 1
    assert passages[0].bbox == {"l": 10.0, "t": 20.0, "r": 300.0, "b": 40.0}
    assert (
        json.loads(cache.read_text(encoding="utf-8"))["parser"]
        == docling_parser.PARSER_VERSION
    )
    assert docling_parser.parse_pdf(str(pdf), "P-0001", tmp_path) == passages
    converter.convert.assert_called_once()


def test_large_passage_splits_keep_docling_box():
    bbox = {"l": 10.0, "t": 20.0, "r": 300.0, "b": 700.0}
    raw = [
        {
            "section": None,
            "kind": "paragraph",
            "page": 1,
            "bbox": bbox,
            "page_width": 600,
            "page_height": 800,
            "text": ("A source sentence describing the study results. " * 30),
        }
    ]
    passages = docling_parser.split_large_passages_and_merge(
        raw, "unused.pdf", "P-0001"
    )
    assert len(passages) > 1
    assert all(p.bbox == bbox and p.page == 1 for p in passages)


def test_multi_page_item_uses_each_docling_character_span():
    first = "Evidence belongs to the first PDF page. "
    second = "Different evidence belongs to the second page."
    p1 = SimpleNamespace(
        page_no=1, charspan=(0, len(first)), bbox=SimpleNamespace(l=1, t=2, r=3, b=4)
    )
    p2 = SimpleNamespace(
        page_no=2,
        charspan=(len(first), len(first + second)),
        bbox=SimpleNamespace(l=5, t=6, r=7, b=8),
    )
    item = SimpleNamespace(prov=[p1, p2])
    fragments = docling_parser.provenance_fragments(item, first + second)
    assert fragments == [(p1, first.strip()), (p2, second)]
    assert second not in fragments[0][1]


def test_ambiguous_multi_region_item_fails_instead_of_guessing_a_page():
    item = SimpleNamespace(
        prov=[SimpleNamespace(page_no=1), SimpleNamespace(page_no=2)]
    )
    with pytest.raises(ValueError, match="cannot assign evidence to a page safely"):
        docling_parser.provenance_fragments(
            item, "A source item crossing two PDF pages."
        )
