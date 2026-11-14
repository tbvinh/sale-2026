package com.vinhcancode.sales.service;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamReader;

/**
 * Đọc file .xlsx (OOXML) và .csv tối giản chỉ bằng JDK: ZIP + StAX XML parser, không cần thêm thư viện ngoài.
 */
public final class XlsxReader {

    private XlsxReader() { }

    /**
     * Đọc toàn bộ nội dung file (hỗ trợ .xlsx và .csv).
     * Trả về danh sách các dòng, mỗi dòng là danh sách các ô (String).
     */
    public static List<List<String>> read(InputStream in) throws Exception {
        byte[] bytes = toByteArray(in);
        if (isZip(bytes)) {
            return readXlsx(bytes);
        } else {
            return readCsv(bytes);
        }
    }

    private static boolean isZip(byte[] b) {
        return b != null && b.length >= 4 && b[0] == 0x50 && b[1] == 0x4B && b[2] == 0x03 && b[3] == 0x04;
    }

    private static byte[] toByteArray(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[8192];
        int n;
        while ((n = in.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, n);
        }
        return buffer.toByteArray();
    }

    private static List<List<String>> readXlsx(byte[] bytes) throws Exception {
        Map<String, byte[]> zipEntries = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (!entry.isDirectory()) {
                    ByteArrayOutputStream entryOut = new ByteArrayOutputStream();
                    byte[] buf = new byte[4096];
                    int len;
                    while ((len = zis.read(buf)) > 0) {
                        entryOut.write(buf, 0, len);
                    }
                    zipEntries.put(entry.getName(), entryOut.toByteArray());
                }
                zis.closeEntry();
            }
        }

        // 1. Đọc sharedStrings.xml nếu có
        List<String> sharedStrings = new ArrayList<>();
        byte[] sstBytes = zipEntries.get("xl/sharedStrings.xml");
        if (sstBytes != null) {
            XMLInputFactory xmlFactory = createXmlInputFactory();
            XMLStreamReader reader = xmlFactory.createXMLStreamReader(new ByteArrayInputStream(sstBytes));
            StringBuilder textBuf = null;
            boolean inSi = false;
            while (reader.hasNext()) {
                int event = reader.next();
                if (event == XMLStreamConstants.START_ELEMENT) {
                    String local = reader.getLocalName();
                    if ("si".equals(local)) {
                        inSi = true;
                        textBuf = new StringBuilder();
                    }
                } else if (event == XMLStreamConstants.CHARACTERS && inSi && textBuf != null) {
                    textBuf.append(reader.getText());
                } else if (event == XMLStreamConstants.END_ELEMENT) {
                    String local = reader.getLocalName();
                    if ("si".equals(local)) {
                        sharedStrings.add(textBuf != null ? textBuf.toString() : "");
                        inSi = false;
                        textBuf = null;
                    }
                }
            }
            reader.close();
        }

        // 2. Tìm sheet1.xml (hoặc sheet đầu tiên)
        String sheetPath = "xl/worksheets/sheet1.xml";
        if (!zipEntries.containsKey(sheetPath)) {
            for (String key : zipEntries.keySet()) {
                if (key.startsWith("xl/worksheets/sheet") && key.endsWith(".xml")) {
                    sheetPath = key;
                    break;
                }
            }
        }

        byte[] sheetBytes = zipEntries.get(sheetPath);
        if (sheetBytes == null) return List.of();

        List<List<String>> rows = new ArrayList<>();
        List<String> currentRow = null;
        String cellRef = null;
        String cellType = null;
        StringBuilder cellValue = null;
        boolean inV = false;
        boolean inT = false;

        XMLInputFactory xmlFactory = createXmlInputFactory();
        XMLStreamReader reader = xmlFactory.createXMLStreamReader(new ByteArrayInputStream(sheetBytes));

        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                String local = reader.getLocalName();
                if ("row".equals(local)) {
                    currentRow = new ArrayList<>();
                } else if ("c".equals(local)) {
                    cellRef = reader.getAttributeValue(null, "r");
                    cellType = reader.getAttributeValue(null, "t");
                    cellValue = new StringBuilder();
                } else if ("v".equals(local)) {
                    inV = true;
                } else if ("t".equals(local)) {
                    inT = true;
                }
            } else if (event == XMLStreamConstants.CHARACTERS) {
                if ((inV || inT) && cellValue != null) {
                    cellValue.append(reader.getText());
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String local = reader.getLocalName();
                if ("v".equals(local)) {
                    inV = false;
                } else if ("t".equals(local)) {
                    inT = false;
                } else if ("c".equals(local)) {
                    if (currentRow != null && cellRef != null) {
                        int col = colIndex(cellRef);
                        String raw = cellValue != null ? cellValue.toString().trim() : "";
                        String val = raw;
                        if ("s".equals(cellType)) {
                            try {
                                int idx = Integer.parseInt(raw);
                                if (idx >= 0 && idx < sharedStrings.size()) {
                                    val = sharedStrings.get(idx);
                                }
                            } catch (NumberFormatException ignored) { }
                        }
                        while (currentRow.size() <= col) {
                            currentRow.add("");
                        }
                        currentRow.set(col, val);
                    }
                    cellRef = null;
                    cellType = null;
                    cellValue = null;
                } else if ("row".equals(local)) {
                    if (currentRow != null) {
                        // Bỏ các ô trống ở cuối dòng
                        while (!currentRow.isEmpty() && currentRow.get(currentRow.size() - 1).isBlank()) {
                            currentRow.remove(currentRow.size() - 1);
                        }
                        if (!currentRow.isEmpty()) {
                            rows.add(currentRow);
                        }
                    }
                    currentRow = null;
                }
            }
        }
        reader.close();
        return rows;
    }

    private static int colIndex(String ref) {
        int col = 0;
        for (int i = 0; i < ref.length(); i++) {
            char ch = ref.charAt(i);
            if (Character.isLetter(ch)) {
                col = col * 26 + (Character.toUpperCase(ch) - 'A' + 1);
            } else {
                break;
            }
        }
        return Math.max(0, col - 1);
    }

    private static XMLInputFactory createXmlInputFactory() {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, Boolean.FALSE);
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, Boolean.FALSE);
        return factory;
    }

    private static List<List<String>> readCsv(byte[] bytes) throws IOException {
        String text = new String(bytes, StandardCharsets.UTF_8).replace("\uFEFF", "");
        char delim = detectDelimiter(text);
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cell.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == delim) {
                row.add(cell.toString().trim());
                cell.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(cell.toString().trim());
                cell.setLength(0);
                if (row.stream().anyMatch(s -> !s.isBlank())) {
                    rows.add(row);
                }
                row = new ArrayList<>();
            } else {
                cell.append(c);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString().trim());
            if (row.stream().anyMatch(s -> !s.isBlank())) {
                rows.add(row);
            }
        }
        return rows;
    }

    private static char detectDelimiter(String text) {
        String firstLine = text.split("\r?\n", 2)[0];
        long semicolons = firstLine.chars().filter(c -> c == ';').count();
        long commas = firstLine.chars().filter(c -> c == ',').count();
        long tabs = firstLine.chars().filter(c -> c == '\t').count();
        if (tabs > commas && tabs > semicolons) return '\t';
        if (semicolons > commas) return ';';
        return ',';
    }
}

