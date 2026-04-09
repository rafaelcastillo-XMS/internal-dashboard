"""
tools/pdf_export.py
Generate a professional PDF from a structured JSON payload using ReportLab.

Follows the pdf-skill guidelines:
  - Consistent typography, spacing, margins, and section hierarchy
  - Tables with proper word-wrap (Paragraph cells, not plain strings)
  - Header/footer on every page with report title and page number
  - ASCII hyphens only; no Unicode dashes or tool tokens
  - Charts, tables, and summary cards are sharp, aligned, and clearly labeled

Args:
  --input   path to JSON payload
  --output  path to output PDF
"""

import argparse
import json
import os
from datetime import datetime
from functools import partial

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.utils import simpleSplit
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ─── Brand colours ─────────────────────────────────────────────────────────────

BRAND_DARK       = colors.HexColor("#0F172A")
BRAND_BLUE       = colors.HexColor("#1A72D9")
BRAND_ORANGE     = colors.HexColor("#F47C20")
BRAND_SLATE_100  = colors.HexColor("#F1F5F9")
BRAND_SLATE_200  = colors.HexColor("#E2E8F0")
BRAND_SLATE_400  = colors.HexColor("#94A3B8")
BRAND_SLATE_600  = colors.HexColor("#475569")
BRAND_SLATE_800  = colors.HexColor("#1E293B")
BRAND_WHITE      = colors.white


# ─── Styles ────────────────────────────────────────────────────────────────────

def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles["Title"] = ParagraphStyle(
        "Title",
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=28,
        textColor=BRAND_DARK,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    styles["Subtitle"] = ParagraphStyle(
        "Subtitle",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=BRAND_SLATE_600,
        spaceAfter=4,
    )
    styles["Meta"] = ParagraphStyle(
        "Meta",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=BRAND_SLATE_400,
        spaceAfter=2,
    )
    styles["SectionHeading"] = ParagraphStyle(
        "SectionHeading",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=BRAND_DARK,
        spaceBefore=14,
        spaceAfter=6,
        borderPad=0,
    )
    styles["Body"] = ParagraphStyle(
        "Body",
        fontName="Helvetica",
        fontSize=9,
        leading=14,
        textColor=BRAND_SLATE_800,
        spaceAfter=6,
    )
    styles["TableHeader"] = ParagraphStyle(
        "TableHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=BRAND_WHITE,
        alignment=TA_LEFT,
    )
    styles["TableCell"] = ParagraphStyle(
        "TableCell",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=BRAND_SLATE_800,
        wordWrap="CJK",
    )
    styles["TableCellBold"] = ParagraphStyle(
        "TableCellBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=BRAND_DARK,
        wordWrap="CJK",
    )
    styles["CardLabel"] = ParagraphStyle(
        "CardLabel",
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=10,
        textColor=BRAND_SLATE_400,
        spaceAfter=2,
    )
    styles["CardValue"] = ParagraphStyle(
        "CardValue",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=BRAND_DARK,
    )
    styles["CardNote"] = ParagraphStyle(
        "CardNote",
        fontName="Helvetica",
        fontSize=7,
        leading=10,
        textColor=BRAND_SLATE_400,
        spaceBefore=2,
    )

    return styles


# ─── Header / Footer ────────────────────────────────────────────────────────────

def _draw_header_footer(canvas, doc, report_title: str):
    canvas.saveState()
    width, height = A4

    # Top accent bar
    canvas.setFillColor(BRAND_BLUE)
    canvas.rect(0, height - 28, width, 28, fill=True, stroke=False)

    # Header: report title left, XMS Ai right
    canvas.setFillColor(BRAND_WHITE)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(0.5 * inch, height - 18, report_title)
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(width - 0.5 * inch, height - 18, "XMS Ai Platform")

    # Footer separator
    canvas.setStrokeColor(BRAND_SLATE_200)
    canvas.setLineWidth(0.5)
    canvas.line(0.5 * inch, 0.5 * inch, width - 0.5 * inch, 0.5 * inch)

    # Footer text
    canvas.setFillColor(BRAND_SLATE_400)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.5 * inch, 0.35 * inch, "Confidential - XMS Ai Intelligence Platform")
    canvas.drawRightString(
        width - 0.5 * inch,
        0.35 * inch,
        f"Page {doc.page}",
    )

    canvas.restoreState()


# ─── Summary cards ──────────────────────────────────────────────────────────────

def build_summary_cards(cards, styles, usable_width):
    per_row   = 3 if len(cards) >= 3 else len(cards)
    pad       = 10
    col_width = usable_width / per_row

    rows = []
    row  = []
    for i, card in enumerate(cards):
        inner = [
            Paragraph(card.get("label", "").upper(), styles["CardLabel"]),
            Paragraph(str(card.get("value", "")), styles["CardValue"]),
        ]
        if card.get("note"):
            inner.append(Paragraph(card["note"], styles["CardNote"]))
        row.append(inner)
        if len(row) == per_row or i == len(cards) - 1:
            while len(row) < per_row:
                row.append("")
            rows.append(row)
            row = []

    col_widths = [col_width] * per_row
    tbl = Table(rows, colWidths=col_widths, rowHeights=None)
    tbl.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND",   (0, 0), (-1, -1), BRAND_SLATE_100),
        ("BOX",          (0, 0), (-1, -1), 0.5, BRAND_SLATE_200),
        ("INNERGRID",    (0, 0), (-1, -1), 0.5, BRAND_SLATE_200),
        ("LEFTPADDING",  (0, 0), (-1, -1), pad),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING",   (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 10),
    ]))
    return tbl


# ─── Data table with word-wrap ──────────────────────────────────────────────────

def build_data_table(columns, rows, styles, usable_width, max_rows=200):
    """Build a ReportLab Table where every cell is a Paragraph for proper word-wrap."""
    n_cols = max(len(columns), 1)

    # Smart column widths: first column gets 30% more if it looks like a name/text column
    base = usable_width / n_cols
    col_widths = [base] * n_cols
    if n_cols > 2:
        # First column is usually the name/keyword - give it more space
        col_widths[0] = base * 1.6
        remaining = usable_width - col_widths[0]
        per_rest  = remaining / (n_cols - 1)
        for i in range(1, n_cols):
            col_widths[i] = per_rest

    # Header row
    header_cells = [
        Paragraph(str(col).upper(), styles["TableHeader"]) for col in columns
    ]

    table_data = [header_cells]

    for i, raw_row in enumerate(rows[:max_rows]):
        cells = []
        for j, cell_val in enumerate(raw_row):
            style = styles["TableCellBold"] if j == 0 else styles["TableCell"]
            cells.append(Paragraph(str(cell_val), style))
        # Pad if row is shorter than headers
        while len(cells) < n_cols:
            cells.append(Paragraph("", styles["TableCell"]))
        table_data.append(cells)

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")

    row_bg_1 = colors.white
    row_bg_2 = BRAND_SLATE_100

    tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND",   (0, 0), (-1, 0),  BRAND_DARK),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  BRAND_WHITE),
        ("FONTNAME",     (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0),  8),
        ("TOPPADDING",   (0, 0), (-1, 0),  8),
        ("BOTTOMPADDING",(0, 0), (-1, 0),  8),
        ("LEFTPADDING",  (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        # Rows
        ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",     (0, 1), (-1, -1), 8),
        ("TOPPADDING",   (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 1), (-1, -1), 6),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("ALIGN",        (0, 0), (-1, -1), "LEFT"),
        ("GRID",         (0, 0), (-1, -1), 0.4, BRAND_SLATE_200),
        # Alternating rows
        *[
            ("BACKGROUND", (0, i), (-1, i), row_bg_1 if i % 2 == 1 else row_bg_2)
            for i in range(1, len(table_data))
        ],
    ]))
    return tbl


# ─── PDF builder ───────────────────────────────────────────────────────────────

def create_pdf(payload: dict, output_path: str):
    styles = build_styles()

    title      = payload.get("title", "XMS Report")
    subtitle   = payload.get("subtitle", "")
    gen_at     = payload.get("generatedAt") or datetime.now().strftime("%B %d, %Y  %H:%M")
    cards      = payload.get("summaryCards") or []
    sections   = payload.get("sections")    or []
    tables_raw = payload.get("tables")      or []

    left  = right = 0.55 * inch
    top   = 0.85 * inch   # space for header bar
    bot   = 0.65 * inch   # space for footer
    page_w, page_h = A4
    usable_w = page_w - left - right

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=left,
        rightMargin=right,
        topMargin=top,
        bottomMargin=bot,
        title=title,
        author="XMS Ai Platform",
    )

    on_page = partial(_draw_header_footer, report_title=title)

    story = []

    # ── Title block ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(title, styles["Title"]))
    if subtitle:
        story.append(Paragraph(subtitle, styles["Subtitle"]))
    story.append(Paragraph(f"Generated: {gen_at}", styles["Meta"]))
    story.append(Spacer(1, 0.2 * inch))

    # Thin blue rule under title
    rule = Table([[""]], colWidths=[usable_w], rowHeights=[2])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), BRAND_BLUE)]))
    story.append(rule)
    story.append(Spacer(1, 0.2 * inch))

    # ── Summary cards ───────────────────────────────────────────────────────────
    if cards:
        story.append(build_summary_cards(cards, styles, usable_w))
        story.append(Spacer(1, 0.25 * inch))

    # ── Sections (plain text) ───────────────────────────────────────────────────
    for sec in sections:
        if sec.get("heading"):
            story.append(Paragraph(sec["heading"], styles["SectionHeading"]))
        if sec.get("body"):
            story.append(Paragraph(sec["body"], styles["Body"]))

    if sections:
        story.append(Spacer(1, 0.15 * inch))

    # ── Data tables ─────────────────────────────────────────────────────────────
    for tbl_info in tables_raw:
        if tbl_info.get("title"):
            story.append(Paragraph(tbl_info["title"], styles["SectionHeading"]))

        raw_rows = tbl_info.get("rows") or [["No data available"]]
        cols     = tbl_info.get("columns") or ["Value"]

        story.append(build_data_table(cols, raw_rows, styles, usable_w))

        if tbl_info.get("note"):
            story.append(Spacer(1, 0.06 * inch))
            story.append(Paragraph(tbl_info["note"], styles["Meta"]))
        story.append(Spacer(1, 0.22 * inch))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


# ─── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate XMS Intelligence PDF report")
    parser.add_argument("--input",  required=True, help="Path to JSON payload file")
    parser.add_argument("--output", required=True, help="Path for output PDF file")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    create_pdf(payload, args.output)
    print(f"[pdf-export] OK - {args.output}")


if __name__ == "__main__":
    main()
