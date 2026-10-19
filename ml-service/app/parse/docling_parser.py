import json
import logging
from pathlib import Path

from app.schemas import Passage
from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)
PARSER_VERSION = "docling-v2-region-spans"


def provenance_fragments(item, text: str):
    """Never attach a multi-page item's entire text to its first provenance box."""
    provenance = item.prov
    if len(provenance) == 1:
        return [(provenance[0], text)]
    fragments = []
    for prov in provenance:
        span = getattr(prov, "charspan", None)
        if not span or len(span) != 2 or not (0 <= span[0] < span[1] <= len(text)):
            raise ValueError(
                "Docling item has multiple source regions without usable character spans; cannot assign evidence to a page safely"
            )
        fragment = text[span[0] : span[1]].strip()
        if fragment:
            fragments.append((prov, fragment))
    return fragments


def normalize_label(label: str) -> str:
    lbl = label.lower()
    if "table" in lbl:
        return "table"
    elif "caption" in lbl:
        return "caption"
    elif "list" in lbl:
        return "list"
    elif "title" in lbl or "header" in lbl:
        return "title"
    return "paragraph"


def split_large_passages_and_merge(
    raw_passages: list[dict], pdf_full_path: str, paper_id: str
) -> list[Passage]:
    """
    1. Splits any passage whose bbox height > 45% of page height (unless single table).
    2. Merges only consecutive paragraphs on the same page and section when EACH is under 200 chars.
    3. Never merges across pages.
    """
    split_list: list[dict] = []

    for p in raw_passages:
        page_h = p["page_height"]
        bbox = p["bbox"]
        h = bbox["b"] - bbox["t"]

        # If height > 45% of page height and not a table, split into sub-paragraphs
        if h > 0.45 * page_h and p["kind"] != "table":
            text = p["text"]

            # Split by double newlines or sentences into ~400 char segments
            paras = [
                para.strip() for para in text.split("\n\n") if len(para.strip()) > 10
            ]
            if len(paras) <= 1:
                sentences = [
                    s.strip() + "." for s in text.split(". ") if len(s.strip()) > 5
                ]
                paras = []
                cur_para = []
                cur_len = 0
                for s in sentences:
                    if cur_len + len(s) > 350 and cur_para:
                        paras.append(" ".join(cur_para))
                        cur_para = [s]
                        cur_len = len(s)
                    else:
                        cur_para.append(s)
                        cur_len += len(s)
                if cur_para:
                    paras.append(" ".join(cur_para))

            for para in paras:
                split_list.append(
                    {
                        "section": p["section"],
                        "kind": p["kind"],
                        "page": p["page"],
                        # A text split retains its source Docling box; never invent a smaller region.
                        "bbox": dict(bbox),
                        "page_width": p["page_width"],
                        "page_height": p["page_height"],
                        "text": para,
                    }
                )
        else:
            split_list.append(p)

    # Merging step:
    # "only merge consecutive paragraphs on the same page and section when EACH is under 200 chars, and never merge across pages"
    merged_items: list[dict] = []
    i = 0
    while i < len(split_list):
        curr = split_list[i]
        if i + 1 < len(split_list):
            nxt = split_list[i + 1]
            if (
                curr["page"] == nxt["page"]
                and curr["section"] == nxt["section"]
                and curr["kind"] == "paragraph"
                and nxt["kind"] == "paragraph"
                and len(curr["text"].strip()) < 200
                and len(nxt["text"].strip()) < 200
            ):
                merged_bbox = {
                    "l": min(curr["bbox"]["l"], nxt["bbox"]["l"]),
                    "t": min(curr["bbox"]["t"], nxt["bbox"]["t"]),
                    "r": max(curr["bbox"]["r"], nxt["bbox"]["r"]),
                    "b": max(curr["bbox"]["b"], nxt["bbox"]["b"]),
                }
                merged_items.append(
                    {
                        "section": curr["section"],
                        "kind": "paragraph",
                        "page": curr["page"],
                        "bbox": merged_bbox,
                        "page_width": curr["page_width"],
                        "page_height": curr["page_height"],
                        "text": curr["text"].strip() + "\n\n" + nxt["text"].strip(),
                    }
                )
                i += 2
                continue

        merged_items.append(curr)
        i += 1

    # Build final Passage objects with clean ord and ID
    paper_num = paper_id.removeprefix("P-")
    passages: list[Passage] = []
    for ord_idx, item in enumerate(merged_items, start=1):
        pid = f"E-{paper_num}-{ord_idx:04d}"
        passages.append(
            Passage(
                id=pid,
                section=item["section"],
                kind=item["kind"],
                page=item["page"],
                bbox=item["bbox"],
                page_width=item["page_width"],
                page_height=item["page_height"],
                text=item["text"].strip(),
                ord=ord_idx,
            )
        )

    return passages


def parse_pdf(pdf_full_path: str, paper_id: str, storage_root: Path) -> list[Passage]:
    # Check cache first
    cache_path = storage_root / "parsed" / f"{paper_id}.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if cache_path.exists():
        try:
            cached_data = json.loads(cache_path.read_text(encoding="utf-8"))
            if (
                isinstance(cached_data, dict)
                and cached_data.get("parser") == PARSER_VERSION
            ):
                return [Passage(**p) for p in cached_data["passages"]]
        except (ValueError, KeyError, OSError) as exc:
            logger.warning("Ignoring invalid parse cache for %s: %s", paper_id, exc)

    raw_passages: list[dict] = []

    try:
        converter = DocumentConverter()
        conv_res = converter.convert(pdf_full_path)
        doc = conv_res.document

        section = None
        for item, _level in doc.iterate_items():
            label = str(getattr(item, "label", "")).lower()
            if "section_header" in label or label.endswith("title"):
                section = getattr(item, "text", None)

            text = (
                item.export_to_markdown(doc=doc)
                if "table" in label
                else getattr(item, "text", "")
            )
            if not text or len(text.strip()) < 20 or not getattr(item, "prov", None):
                continue

            for prov, fragment in provenance_fragments(item, text):
                page_no = prov.page_no
                page = doc.pages[page_no]
                raw_bbox = prov.bbox
                if hasattr(raw_bbox, "to_top_left_origin"):
                    bbox = raw_bbox.to_top_left_origin(page_height=page.size.height)
                    bbox_dict = {
                        "l": float(bbox.l),
                        "t": float(bbox.t),
                        "r": float(bbox.r),
                        "b": float(bbox.b),
                    }
                else:
                    bbox_dict = {
                        "l": float(raw_bbox.l),
                        "t": float(raw_bbox.t),
                        "r": float(raw_bbox.r),
                        "b": float(raw_bbox.b),
                    }
                raw_passages.append(
                    {
                        "section": section,
                        "kind": normalize_label(label),
                        "page": page_no,
                        "bbox": bbox_dict,
                        "page_width": float(page.size.width),
                        "page_height": float(page.size.height),
                        "text": fragment,
                    }
                )

    except Exception as exc:
        raise RuntimeError(f"Docling could not parse {paper_id}: {exc}") from exc

    if not raw_passages:
        raise RuntimeError(
            f"Docling returned no passages with provenance for {paper_id}"
        )

    # Apply strict splitting and merging
    passages = split_large_passages_and_merge(raw_passages, pdf_full_path, paper_id)

    # Save to disk cache
    try:
        cache_path.write_text(
            json.dumps(
                {
                    "parser": PARSER_VERSION,
                    "passages": [p.model_dump() for p in passages],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Could not cache parsed passages for %s: %s", paper_id, exc)

    return passages
