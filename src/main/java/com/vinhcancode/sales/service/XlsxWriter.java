package com.vinhcancode.sales.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Ghi file .xlsx tối giản (OOXML) chỉ bằng JDK: ZIP + XML, không cần thêm dependency vào pom.
 * Dùng chung cho xuất Excel danh mục và xuất Excel phiếu kho.
 */
public final class XlsxWriter {

    public static final int TEXT = 0;            // chữ thường
    public static final int HEADER = 1;          // tiêu đề bảng: đậm, nền xanh nhạt, viền, canh giữa
    public static final int NUMBER = 2;          // số có định dạng #,##0 + viền
    public static final int TITLE = 3;           // tiêu đề phiếu: đậm 14, canh giữa
    public static final int LABEL = 4;           // nhãn: đậm
    public static final int TOTAL = 5;           // dòng tổng: đậm, canh phải
    public static final int TOTAL_NUMBER = 6;    // số ở dòng tổng: đậm + #,##0 + viền

    public record Cell(Object value, int style) {
        public static Cell text(Object v) { return new Cell(v, TEXT); }
        public static Cell header(Object v) { return new Cell(v, HEADER); }
        public static Cell number(Object v) { return new Cell(v, NUMBER); }
        public static Cell title(Object v) { return new Cell(v, TITLE); }
        public static Cell label(Object v) { return new Cell(v, LABEL); }
        public static Cell total(Object v) { return new Cell(v, TOTAL); }
        public static Cell totalNumber(Object v) { return new Cell(v, TOTAL_NUMBER); }
        public static Cell of(Object v) { return v instanceof Number ? number(v) : text(v); }
    }

    private XlsxWriter() { }

    /** rows: mỗi phần tử là một dòng; ô null được bỏ trống. autoFilter: bật lọc cho bảng có dòng 1 là tiêu đề cột. */
    public static byte[] write(String sheetName, int[] widths, List<List<Cell>> rows, boolean autoFilter) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(8192);
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            put(zip, "[Content_Types].xml", CONTENT_TYPES);
            put(zip, "_rels/.rels", ROOT_RELS);
            put(zip, "xl/workbook.xml", workbook(sheetName));
            put(zip, "xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
            put(zip, "xl/styles.xml", STYLES);
            put(zip, "xl/worksheets/sheet1.xml", sheet(widths, rows, autoFilter));
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
        return out.toByteArray();
    }

    private static void put(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String workbook(String sheetName) {
        String name = sheetName.replaceAll("[\\\\/*?\\[\\]:]", " ");
        if (name.length() > 31) name = name.substring(0, 31);
        return XML_HEAD + "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\""
                + " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>"
                + "<sheet name=\"" + esc(name) + "\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>";
    }

    private static String sheet(int[] widths, List<List<Cell>> rows, boolean autoFilter) {
        StringBuilder b = new StringBuilder(4096);
        b.append(XML_HEAD).append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
        b.append("<sheetViews><sheetView workbookViewId=\"0\">");
        if (autoFilter) b.append("<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>");
        b.append("</sheetView></sheetViews>");

        if (widths != null && widths.length > 0) {
            b.append("<cols>");
            for (int i = 0; i < widths.length; i++) {
                b.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1)
                        .append("\" width=\"").append(widths[i]).append("\" customWidth=\"1\"/>");
            }
            b.append("</cols>");
        }

        b.append("<sheetData>");
        int r = 1;
        for (List<Cell> row : rows) {
            b.append("<row r=\"").append(r).append("\">");
            if (row != null) {
                for (int c = 0; c < row.size(); c++) {
                    Cell cell = row.get(c);
                    if (cell == null || cell.value() == null) continue;
                    String ref = ref(c, r);
                    Object v = cell.value();
                    if (v instanceof Number n) {
                        b.append("<c r=\"").append(ref).append("\" s=\"").append(cell.style())
                                .append("\"><v>").append(n).append("</v></c>");
                    } else {
                        b.append("<c r=\"").append(ref).append("\" s=\"").append(cell.style())
                                .append("\" t=\"inlineStr\"><is><t>").append(esc(String.valueOf(v))).append("</t></is></c>");
                    }
                }
            }
            b.append("</row>");
            r++;
        }
        b.append("</sheetData>");

        if (autoFilter && rows.size() > 1) {
            int cols = rows.stream().mapToInt(x -> x == null ? 0 : x.size()).max().orElse(1);
            b.append("<autoFilter ref=\"A1:").append(col(Math.max(0, cols - 1))).append(rows.size()).append("\"/>");
        }
        b.append("</worksheet>");
        return b.toString();
    }

    private static String ref(int column, int row) {
        return col(column) + row;
    }

    private static String col(int index) {
        StringBuilder b = new StringBuilder();
        for (int n = index + 1; n > 0; n = (n - 1) / 26) b.insert(0, (char) ('A' + (n - 1) % 26));
        return b.toString();
    }

    private static String esc(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> b.append("&amp;");
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '"' -> b.append("&quot;");
                case '\'' -> b.append("&apos;");
                default -> {
                    if (c >= 0x20 || c == '\t' || c == '\n' || c == '\r') b.append(c);
                }
            }
        }
        return b.toString();
    }

    /* ---------- Các phần XML cố định của gói OOXML ---------- */

    private static final String XML_HEAD = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>";

    private static final String CONTENT_TYPES = XML_HEAD + """
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
              <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
            </Types>""";

    private static final String ROOT_RELS = XML_HEAD + """
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>""";

    private static final String WORKBOOK_RELS = XML_HEAD + """
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
            </Relationships>""";

    private static final String STYLES = XML_HEAD + """
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <fonts count="3">
                <font><sz val="11"/><name val="Calibri"/></font>
                <font><b/><sz val="11"/><name val="Calibri"/></font>
                <font><b/><sz val="14"/><name val="Calibri"/></font>
              </fonts>
              <fills count="3">
                <fill><patternFill patternType="none"/></fill>
                <fill><patternFill patternType="gray125"/></fill>
                <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>
              </fills>
              <borders count="2">
                <border><left/><right/><top/><bottom/><diagonal/></border>
                <border><left style="thin"><color rgb="FFA6A6A6"/></left><right style="thin"><color rgb="FFA6A6A6"/></right><top style="thin"><color rgb="FFA6A6A6"/></top><bottom style="thin"><color rgb="FFA6A6A6"/></bottom><diagonal/></border>
              </borders>
              <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
              <cellXfs count="7">
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
                <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
                <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
                <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>
                <xf numFmtId="3" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
              </cellXfs>
              <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
            </styleSheet>""";
}
