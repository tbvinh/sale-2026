package com.vinhcancode.sales.service;

import java.util.ArrayList;
import java.util.List;

/** Doc so tien bang chu (tieng Viet) de in tren chung tu thu / chi. */
public final class AmountInWords {

    private static final String[] DIGIT = { "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín" };
    private static final String[] SCALE = { "", " nghìn", " triệu" };

    private AmountInWords() { }

    public static String vnd(long amount) {
        if (amount < 0) return "Âm " + read(-amount) + " đồng";
        if (amount == 0) return "Không đồng";
        String text = read(amount);
        return Character.toUpperCase(text.charAt(0)) + text.substring(1) + " đồng";
    }

    private static String read(long amount) {
        List<Integer> groups = new ArrayList<>();
        for (long n = amount; n > 0; n /= 1000) groups.add((int) (n % 1000));

        StringBuilder out = new StringBuilder();
        boolean higher = false;
        for (int i = groups.size() - 1; i >= 0; i--) {
            int group = groups.get(i);
            if (group == 0) continue;
            out.append(' ').append(readGroup(group, higher)).append(scale(i));
            higher = true;
        }
        return out.toString().trim();
    }

    private static String readGroup(int group, boolean higher) {
        int hundreds = group / 100;
        int tens = (group % 100) / 10;
        int units = group % 10;
        StringBuilder out = new StringBuilder();

        if (hundreds > 0 || higher) out.append(DIGIT[hundreds]).append(" trăm");
        if (tens > 1) {
            if (out.length() > 0) out.append(' ');
            out.append(DIGIT[tens]).append(" mươi");
        } else if (tens == 1) {
            if (out.length() > 0) out.append(' ');
            out.append("mười");
        } else if (units > 0 && out.length() > 0) {
            out.append(" lẻ");
        }

        if (units > 0) {
            if (tens > 1 && units == 1) out.append(" mốt");
            else if (tens >= 1 && units == 5) out.append(" lăm");
            else {
                if (out.length() > 0) out.append(' ');
                out.append(DIGIT[units]);
            }
        }
        return out.toString();
    }

    private static String scale(int index) {
        String scale = SCALE[index % 3];
        int billions = index / 3;
        for (int i = 0; i < billions; i++) scale += " tỷ";
        return scale;
    }
}
