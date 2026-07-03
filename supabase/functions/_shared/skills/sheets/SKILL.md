# Lumina Sheets Mode — Skill File

## Purpose
Generate correct, usable spreadsheet data with real formulas tied to actual column ranges, proper aggregation layers, and explicit assumptions. Spreadsheet correctness has many small, easy-to-miss rules — this file documents them all.

## Formula Compatibility Across Target Software

### Google Sheets / Excel / LibreOffice Compatible (Safe)
- `SUM(A1:A10)`, `AVERAGE(B2:B100)`, `COUNT(C:C)`, `MIN(D:D)`, `MAX(E:E)`
- `IF(condition, value_if_true, value_if_false)`
- `SUMIF(range, criteria, sum_range)`, `COUNTIF(range, criteria)`
- `VLOOKUP(search_key, range, index, is_sorted)` — use `FALSE` for exact match
- `XLOOKUP(search, lookup, result, [if_not_found])` — Google Sheets + Excel 365
- `CONCATENATE(A1, " ", B1)` or `A1 & " " & B1`
- `LEFT(text, n)`, `RIGHT(text, n)`, `MID(text, start, n)`, `LEN(text)`
- `ROUND(number, digits)`, `ROUNDUP()`, `ROUNDDOWN()`
- `DATE(year, month, day)`, `YEAR(date)`, `MONTH(date)`, `DAY(date)`
- `NOW()`, `TODAY()`
- `FILTER(range, condition)` — Google Sheets + Excel 365
- `SORT(range, column, ascending)` — Google Sheets + Excel 365
- `UNIQUE(range)` — Google Sheets + Excel 365
- `IFERROR(value, fallback)` — all modern versions
- `ARRAYFORMULA(array_formula)` — Google Sheets only; wrap array formulas
- `QUERY(data, query_string, [headers])` — Google Sheets only; powerful SQL-like

### Google Sheets Only (avoid in cross-format tasks)
- `GOOGLEFINANCE()`, `GOOGLETRANSLATE()`, `IMAGE()`
- `IMPORTRANGE()`, `IMPORTXML()`, `IMPORTHTML()`
- `SPARKLINE()` — chartless mini-charts
- `FLATTEN()` — experimental

### Excel Only (avoid in cross-format tasks)
- `XLOOKUP()` with Excel-specific arguments
- `SWITCH()`, `TEXTJOIN()` — Excel 2019+ (also in Google Sheets now)
- `IFS()`, `MAXIFS()`, `MINIFS()` — Excel 2019+
- `LET()`, `LAMBDA()` — Excel 365 only

### Always avoid
- Volatile arrays that spill without `ARRAYFORMULA` wrapper (Google Sheets)
- Mixed relative/absolute references without clear intent (`=A$1:$B10` is confusing)
- Nested IF chains deeper than 5 levels (use `IFS`, `SWITCH`, or a lookup table instead)
- `INDIRECT()` with string-built references — fragile and slow at scale

## Data Architecture

### Always structure in layers

1. **Raw Data layer** — the input rows as-is (or lightly cleaned)
   - Named: `Raw_{table_name}` sheet/range
   - One header row, data rows below
   - Headers in bold, frozen row
   - No merged cells in data area
   - No blank rows within data

2. **Summarized / Grouped layer** — aggregated from raw
   - Named: `Summary_{dimension}` sheet/range
   - Created via `FILTER`, `QUERY`, or pivot table logic
   - This is what charts should reference, NOT raw rows
   - A summary layer MUST exist if the task asks for charts

3. **Assumptions / Inputs layer** — visible and editable
   - Named: `Inputs` or `Assumptions`
   - Every magic number, rate, threshold, or parameter goes here
   - Example: tax rate, discount percentage, growth assumption, date range
   - Every assumption cell is labeled with a clear name and optional description
   - Formulas reference `Assumptions!B2` NOT hardcoded `0.08`
   - This section is the FIRST thing a reviewer checks

4. **Output / Dashboard layer** — what the user sees
   - Named: `Dashboard` or `Output`
   - Clean, formatted view with only the key metrics and charts
   - No raw data visible here

### Cell formatting defaults
- **Numbers**: general number format (2 decimal places for currency)
- **Currency**: `$#,##0.00` (or locale-specific: `£#,##0.00`, `€#,##0.00`)
- **Percentages**: `0.00%` (always store as decimals, display as %)
- **Dates**: `YYYY-MM-DD` ISO format
- **Text**: left-aligned
- **Headers**: bold, background fill (light grey `#f0f0f0` or theme color at 10% opacity)
- **Gridlines**: always visible unless dashboard output
- **Column widths**: auto-fit content, minimum 80px, maximum 400px
- **Freeze**: freeze header row(s) on every sheet with data

## Charting Rules

- Charts MUST come from the Summary layer, never from Raw rows
- Chart type selection:
  - Time series → Line chart
  - Category comparison → Column/Bar chart
  - Composition → Stacked bar or Pie (max 6 slices)
  - Distribution → Histogram (via column chart with bins)
  - Relationship → Scatter plot with optional trendline
- Every chart has: title, axis labels, legend (if > 1 series)
- Color palette: use the theme's primary/accent palette, never default Excel colors

## Validation Checklist (execute before declaring done)

- [ ] **Formula ranges match actual data**: For every formula, count that the range `A2:A100` actually covers the non-empty cells. The most common failure: formulas reference `A2:A1000` but data is `A2:A50` (works but fragile), or worse, references `A2:A10` when data has 200 rows (silent data loss)
- [ ] **Assumptions section exists**: If any formula uses a non-trivial constant (> 5 or complex threshold), it must reference an Assumptions/Inputs cell, not a hardcoded value
- [ ] **Summary layer exists for charts**: If charts are in scope, verify a grouped/aggregated sheet exists
- [ ] **Header row frozen**: Every data sheet has its header row frozen
- [ ] **No merged cells in data**: Merged cells break sorting, filtering, and formula autofill. Use Center Across Selection instead for display headers
- [ ] **Consistent formula direction**: Drag-right formulas are rare — verify they make sense. Most formulas should drag DOWN
- [ ] **No circular references**: Trace formula chains to ensure no cell references itself (even indirectly through 2+ hops)
- [ ] **Format correctness**: Currency formatted as currency, percentages as percentages, dates as dates
- [ ] **Locale-safe separators**: Use commas as function argument separators (`,`), not semicolons (`;`), unless locale requires otherwise
- [ ] **Array formula wrapper**: In Google Sheets, any formula returning an array must be wrapped in `ARRAYFORMULA()` if it references ranges
- [ ] **Named ranges for cross-sheet refs**: If a formula references another sheet, use `SheetName!A1` notation consistently; consider named ranges if reference is used 3+ times
- [ ] **No blank rows in data**: Flag any embedded blank rows in raw data that would break formulas
- [ ] **Outlier flag**: If numerical data has extreme values that would skew averages, add a note or conditional formatting to flag them
