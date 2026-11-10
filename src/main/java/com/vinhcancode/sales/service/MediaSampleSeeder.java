package com.vinhcancode.sales.service;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Sinh bo anh SVG mau (AGV, vat tu, avatar) vao {upload-dir}/samples khi khoi dong. */
@ApplicationScoped
public class MediaSampleSeeder {

    @ConfigProperty(name = "media.upload-dir", defaultValue = "./uploads")
    String uploadDir;

    void onStart(@Observes StartupEvent event) {
        Path samples = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("samples");
        for (Map.Entry<String, String> entry : svgs().entrySet()) {
            Path target = samples.resolve(entry.getKey()).normalize();
            if (!target.startsWith(samples)) continue;
            try {
                if (Files.exists(target) && !Files.isWritable(target)) continue;
                Files.createDirectories(target.getParent());
                Files.writeString(target, entry.getValue(), StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            } catch (IOException e) {
                System.err.println("WARN [MediaSampleSeeder] Skip seeding " + target + ": " + e.getMessage());
            }
        }
    }

    private static Map<String, String> svgs() {
        Map<String, String> svg = new LinkedHashMap<>();
        svg.put("products/agv_robot_01.svg", agvPerspective("#f59e0b", "#fbbf24", "#b45309", "AGV 500", "AUTOMATED GUIDED VEHICLE"));
        svg.put("products/agv_robot_02.svg", agvHeavy("#1d4ed8", "#60a5fa", "#1e3a8a", "AGV 1000", "HEAVY LIFT PLATFORM"));
        svg.put("products/agv_robot_side.svg", agvSide("#0f766e", "#2dd4bf", "#134e4a", "AGV SIDE", "LOW PROFILE SERIES"));
        svg.put("products/agv_forklift.svg", agvForklift("#ea580c", "#fdba74", "#9a3412", "AGV FORK", "PALLET HANDLING"));
        svg.put("products/agv_tugger.svg", agvTugger("#7c3aed", "#c4b5fd", "#4c1d95", "AGV TUG", "TUGGER TRAIN"));
        svg.put("products/amr_robot_01.svg", amrRobot("#0369a1", "#38bdf8", "#075985", "AMR X1", "AUTONOMOUS MOBILE ROBOT"));
        svg.put("catalogs/material_steel.svg", icon("STEEL", "#334155", "#94a3b8", steelArt()));
        svg.put("catalogs/material_cement.svg", icon("CEMENT", "#64748b", "#cbd5e1", cementArt()));
        svg.put("catalogs/material_brick.svg", icon("BRICK", "#b45309", "#f59e0b", brickArt()));
        svg.put("catalogs/material_paint.svg", icon("PAINT", "#0e7490", "#67e8f9", paintArt()));
        svg.put("catalogs/material_electrical.svg", icon("MEP", "#1e40af", "#93c5fd", electricalArt()));
        svg.put("users/avatar_admin.svg", avatar("#0f172a", "#2563eb", "#93c5fd", "AD", true));
        svg.put("users/avatar_01.svg", avatar("#0f766e", "#2dd4bf", "#ccfbf1", "AN", false));
        svg.put("users/avatar_02.svg", avatar("#9a3412", "#fb923c", "#ffedd5", "BH", false));
        svg.put("users/avatar_team.svg", avatar("#4c1d95", "#a78bfa", "#ede9fe", "KT", true));
        return svg;
    }

    private static String agvPerspective(String body, String accent, String dark, String title, String subtitle) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-labelledby="title">
  <title id="title">%s</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fbff"/><stop offset="1" stop-color="#dbeafe"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="deck" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#0f172a" flood-opacity=".3"/>
    </filter>
    <radialGradient id="glow"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#0891b2" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="480" rx="28" fill="url(#bg)"/>
  <circle cx="562" cy="76" r="96" fill="#bfdbfe" opacity=".45"/>
  <circle cx="76" cy="404" r="120" fill="#c7d2fe" opacity=".3"/>
  <path d="M36 388 H604" stroke="#94a3b8" stroke-width="2" opacity=".5"/>
  <g stroke="#93c5fd" stroke-width="1" opacity=".45">
    <path d="M82 388 L212 332"/><path d="M164 388 L294 332"/><path d="M246 388 L376 332"/>
    <path d="M328 388 L458 332"/><path d="M410 388 L540 332"/>
  </g>
  <ellipse cx="330" cy="384" rx="206" ry="34" fill="#0f172a" opacity=".22" filter="url(#soft)"/>
  <g filter="url(#shadow)">
    <rect x="150" y="306" width="74" height="66" rx="24" fill="#111827"/>
    <circle cx="187" cy="339" r="17" fill="#374151"/>
    <rect x="430" y="300" width="78" height="66" rx="24" fill="#111827"/>
    <circle cx="469" cy="333" r="17" fill="#374151"/>
    <rect x="362" y="296" width="58" height="58" rx="18" fill="#1f2937" opacity=".9"/>
    <path d="M128 286 Q132 268 156 264 L474 238 L534 286 Q546 298 536 316 L154 348 Q132 350 126 330 Z" fill="#1f2937"/>
    <path d="M150 292 L482 266 L520 296 L160 330 Z" fill="#0f172a"/>
    <path d="M164 186 Q168 166 192 164 L456 144 Q478 143 490 160 L522 210 L512 292 L174 326 Q158 326 156 310 L158 204 Z" fill="url(#body)" stroke="%s" stroke-width="3"/>
    <path d="M490 160 L522 210 L512 292 L474 296 L482 166 Z" fill="%s" opacity=".5"/>
    <path d="M188 166 L456 146 Q474 145 484 158 L500 182 L206 206 Q190 206 188 194 Z" fill="url(#deck)" opacity=".7"/>
    <rect x="196" y="224" width="264" height="40" rx="20" fill="#0f172a" transform="rotate(-3 328 244)"/>
    <circle cx="226" cy="241" r="8" fill="#22d3ee"/>
    <circle cx="254" cy="239" r="8" fill="#22d3ee"/>
    <rect x="288" y="230" width="128" height="18" rx="9" fill="#1e293b" transform="rotate(-3 352 239)"/>
    <ellipse cx="330" cy="170" rx="58" ry="17" fill="#0f172a"/>
    <rect x="272" y="146" width="116" height="26" rx="13" fill="#111827"/>
    <ellipse cx="330" cy="146" rx="58" ry="17" fill="#1e293b"/>
    <ellipse cx="330" cy="146" rx="36" ry="10" fill="#22d3ee" opacity=".9"/>
    <ellipse cx="330" cy="146" rx="64" ry="24" fill="url(#glow)" opacity=".4"/>
    <path d="M438 160 L452 94" stroke="#1f2937" stroke-width="5" stroke-linecap="round"/>
    <circle cx="452" cy="90" r="7" fill="#ef4444"/>
    <g stroke="%s" stroke-width="4" stroke-linecap="round" opacity=".45">
      <path d="M198 286 L330 274"/><path d="M198 300 L318 289"/><path d="M198 314 L306 304"/>
    </g>
    <text x="394" y="284" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="#7c2d12" opacity=".8">AGV</text>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="36" y="34" width="254" height="68" rx="18" fill="#ffffff" opacity=".9"/>
    <text x="58" y="63" font-size="21" font-weight="700" fill="#0f172a">%s</text>
    <text x="58" y="85" font-size="11" letter-spacing="1.4" fill="#475569">%s</text>
  </g>
  <g stroke="#0ea5e9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".8">
    <path d="M542 374 h58"/><path d="M562 354 l24 20 -24 20"/>
  </g>
  <circle cx="520" cy="118" r="10" fill="#22d3ee" opacity=".7"/>
  <circle cx="552" cy="144" r="6" fill="#38bdf8" opacity=".5"/>
</svg>
""".formatted(title, body, accent, dark, dark, dark, title, subtitle);
    }

    private static String agvHeavy(String body, String accent, String dark, String title, String subtitle) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-labelledby="title">
  <title id="title">%s</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eff6ff"/><stop offset="1" stop-color="#dbeafe"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#64748b"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#0f172a" flood-opacity=".28"/></filter>
  </defs>
  <rect width="640" height="480" rx="28" fill="url(#bg)"/>
  <circle cx="86" cy="82" r="88" fill="#bfdbfe" opacity=".5"/>
  <circle cx="560" cy="408" r="106" fill="#c7d2fe" opacity=".3"/>
  <path d="M42 400 H598" stroke="#94a3b8" stroke-width="2" opacity=".5"/>
  <g stroke="#93c5fd" opacity=".4"><path d="M72 400 V330"/><path d="M568 400 V330"/></g>
  <ellipse cx="320" cy="398" rx="224" ry="32" fill="#0f172a" opacity=".2" filter="url(#soft)"/>
  <g filter="url(#shadow)">
    <rect x="106" y="316" width="96" height="78" rx="26" fill="#111827"/>
    <circle cx="154" cy="355" r="21" fill="#374151"/>
    <rect x="438" y="316" width="96" height="78" rx="26" fill="#111827"/>
    <circle cx="486" cy="355" r="21" fill="#374151"/>
    <path d="M96 292 Q100 276 124 274 L516 274 Q540 276 544 292 L548 334 Q550 352 530 354 L110 354 Q90 352 92 334 Z" fill="#1f2937"/>
    <rect x="124" y="300" width="392" height="22" rx="11" fill="#0f172a"/>
    <rect x="138" y="226" width="364" height="74" rx="20" fill="url(#body)" stroke="%s" stroke-width="3"/>
    <rect x="164" y="248" width="312" height="26" rx="13" fill="#0f172a" opacity=".9"/>
    <circle cx="192" cy="261" r="8" fill="#22d3ee"/>
    <circle cx="220" cy="261" r="8" fill="#22d3ee"/>
    <rect x="264" y="253" width="178" height="15" rx="7" fill="#1e293b"/>
    <g stroke="#94a3b8" stroke-width="9" stroke-linecap="round">
      <path d="M210 226 L430 116"/><path d="M430 226 L210 116"/>
    </g>
    <rect x="186" y="100" width="268" height="24" rx="12" fill="url(#steel)" stroke="#475569" stroke-width="2"/>
    <rect x="214" y="54" width="212" height="54" rx="10" fill="#b45309"/>
    <path d="M214 72 H426 M214 90 H426" stroke="#92400e" stroke-width="3" opacity=".7"/>
    <rect x="286" y="66" width="68" height="24" rx="6" fill="#fef3c7"/>
    <text x="320" y="84" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#78350f">1000 kg</text>
    <rect x="160" y="184" width="320" height="16" rx="8" fill="%s" opacity=".85"/>
    <g fill="#fde68a">
      <path d="M176 184 h18 l-12 16 h-18 z"/><path d="M210 184 h18 l-12 16 h-18 z"/>
      <path d="M244 184 h18 l-12 16 h-18 z"/><path d="M278 184 h18 l-12 16 h-18 z"/>
      <path d="M312 184 h18 l-12 16 h-18 z"/><path d="M346 184 h18 l-12 16 h-18 z"/>
      <path d="M380 184 h18 l-12 16 h-18 z"/><path d="M414 184 h18 l-12 16 h-18 z"/>
      <path d="M448 184 h18 l-12 16 h-18 z"/>
    </g>
    <circle cx="320" cy="242" r="12" fill="#f8fafc" opacity=".9"/>
    <circle cx="320" cy="242" r="6" fill="%s"/>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="34" y="34" width="260" height="68" rx="18" fill="#ffffff" opacity=".92"/>
    <text x="56" y="63" font-size="21" font-weight="700" fill="#0f172a">%s</text>
    <text x="56" y="85" font-size="11" letter-spacing="1.4" fill="#475569">%s</text>
  </g>
  <g stroke="#0ea5e9" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75">
    <path d="M542 372 h58"/><path d="M562 352 l24 20 -24 20"/>
  </g>
</svg>
""".formatted(title, body, accent, dark, dark, dark, title, subtitle);
    }

    private static String agvSide(String body, String accent, String dark, String title, String subtitle) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-labelledby="title">
  <title id="title">%s</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0fdfa"/><stop offset="1" stop-color="#ccfbf1"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="deck" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#0f172a" flood-opacity=".26"/></filter>
  </defs>
  <rect width="640" height="480" rx="28" fill="url(#bg)"/>
  <circle cx="556" cy="86" r="92" fill="#99f6e4" opacity=".45"/>
  <circle cx="94" cy="402" r="116" fill="#a7f3d0" opacity=".35"/>
  <path d="M38 392 H602" stroke="#64748b" stroke-width="2" opacity=".45"/>
  <g stroke="#5eead4" stroke-width="1" opacity=".55">
    <path d="M70 392 L190 340"/><path d="M160 392 L280 340"/><path d="M250 392 L370 340"/>
    <path d="M340 392 L460 340"/><path d="M430 392 L550 340"/>
  </g>
  <ellipse cx="320" cy="390" rx="238" ry="30" fill="#0f172a" opacity=".18" filter="url(#soft)"/>
  <g filter="url(#shadow)">
    <circle cx="178" cy="330" r="48" fill="#111827"/>
    <circle cx="178" cy="330" r="24" fill="#374151"/>
    <circle cx="178" cy="330" r="9" fill="#94a3b8"/>
    <circle cx="322" cy="336" r="42" fill="#111827"/>
    <circle cx="322" cy="336" r="20" fill="#374151"/>
    <circle cx="322" cy="336" r="8" fill="#94a3b8"/>
    <circle cx="476" cy="330" r="48" fill="#111827"/>
    <circle cx="476" cy="330" r="24" fill="#374151"/>
    <circle cx="476" cy="330" r="9" fill="#94a3b8"/>
    <path d="M86 272 Q90 254 112 252 L516 236 Q548 236 560 258 L568 300 Q570 322 548 326 L118 340 Q92 340 88 320 Z" fill="#1f2937"/>
    <path d="M104 254 Q108 238 130 236 L518 220 Q542 220 552 238 L564 276 L116 294 Q100 294 98 278 Z" fill="url(#body)" stroke="%s" stroke-width="3"/>
    <rect x="120" y="238" width="420" height="18" rx="9" fill="url(#deck)" opacity=".8"/>
    <rect x="150" y="270" width="128" height="34" rx="12" fill="#0f172a"/>
    <circle cx="176" cy="287" r="7" fill="#22d3ee"/>
    <rect x="196" y="281" width="64" height="12" rx="6" fill="#134e4a"/>
    <rect x="348" y="256" width="170" height="10" rx="5" fill="%s" opacity=".6"/>
    <rect x="348" y="274" width="140" height="10" rx="5" fill="%s" opacity=".45"/>
    <rect x="348" y="292" width="110" height="10" rx="5" fill="%s" opacity=".3"/>
    <rect x="516" y="164" width="18" height="58" rx="9" fill="#0f172a"/>
    <circle cx="525" cy="156" r="19" fill="#111827"/>
    <circle cx="525" cy="156" r="10" fill="%s"/>
    <path d="M525 137 V184" stroke="#22d3ee" stroke-width="3" opacity=".5"/>
    <path d="M270 204 h110" stroke="#0f172a" stroke-width="6" stroke-linecap="round" opacity=".5"/>
    <text x="392" y="312" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#0f172a" opacity=".65">AGV</text>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="34" y="34" width="252" height="68" rx="18" fill="#ffffff" opacity=".92"/>
    <text x="56" y="63" font-size="21" font-weight="700" fill="#0f172a">%s</text>
    <text x="56" y="85" font-size="11" letter-spacing="1.4" fill="#475569">%s</text>
  </g>
  <g stroke="%s" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".75">
    <path d="M52 372 h58"/><path d="M72 352 l-20 20 20 20"/>
    <path d="M530 372 h58"/><path d="M568 352 l20 20 -20 20"/>
  </g>
</svg>
""".formatted(title, body, accent, dark, dark, dark, dark, dark, title, subtitle, dark);
    }

    private static String agvForklift(String body, String accent, String dark, String title, String subtitle) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-labelledby="title">
  <title id="title">%s</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff7ed"/><stop offset="1" stop-color="#fed7aa"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="mast" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#431407" flood-opacity=".24"/></filter>
  </defs>
  <rect width="640" height="480" rx="28" fill="url(#bg)"/>
  <circle cx="92" cy="78" r="88" fill="#fdba74" opacity=".4"/>
  <circle cx="558" cy="410" r="110" fill="#fdba74" opacity=".3"/>
  <path d="M40 398 H600" stroke="#9a3412" stroke-width="2" opacity=".3"/>
  <g stroke="#fb923c" stroke-width="1" opacity=".35">
    <path d="M72 398 L196 344"/><path d="M156 398 L280 344"/><path d="M240 398 L364 344"/>
    <path d="M324 398 L448 344"/><path d="M408 398 L532 344"/>
  </g>
  <ellipse cx="308" cy="396" rx="222" ry="30" fill="#431407" opacity=".2" filter="url(#soft)"/>
  <g filter="url(#shadow)">
    <rect x="108" y="320" width="88" height="70" rx="24" fill="#111827"/>
    <circle cx="152" cy="355" r="19" fill="#374151"/>
    <rect x="286" y="320" width="88" height="70" rx="24" fill="#111827"/>
    <circle cx="330" cy="355" r="19" fill="#374151"/>
    <path d="M96 292 Q100 276 122 274 L376 274 Q400 276 404 292 L410 334 Q412 352 392 354 L110 354 Q90 352 92 334 Z" fill="#1f2937"/>
    <path d="M116 250 Q120 234 142 232 L354 232 Q376 233 384 248 L398 292 L106 292 Z" fill="url(#body)" stroke="%s" stroke-width="3"/>
    <path d="M140 208 Q144 194 164 194 L338 194 Q360 194 366 208 L376 232 L128 232 Z" fill="%s" opacity=".55"/>
    <rect x="142" y="256" width="118" height="28" rx="12" fill="#0f172a" opacity=".9"/>
    <circle cx="164" cy="270" r="6" fill="#22d3ee"/>
    <rect x="266" y="258" width="92" height="24" rx="10" fill="#7c2d12" opacity=".45"/>
    <rect x="404" y="118" width="26" height="236" rx="10" fill="url(#mast)"/>
    <rect x="438" y="126" width="16" height="228" rx="7" fill="#334155"/>
    <rect x="400" y="180" width="58" height="20" rx="8" fill="#0f172a"/>
    <path d="M436 300 h-96 v-18 h132 v18 z" fill="#64748b"/>
    <path d="M372 282 h-28 v52 h22 v-34 z" fill="#94a3b8"/>
    <rect x="336" y="244" width="118" height="38" rx="4" fill="#a16207"/>
    <g stroke="#854d0e" stroke-width="3"><path d="M336 258 H454"/><path d="M336 270 H454"/></g>
    <rect x="350" y="200" width="86" height="44" rx="5" fill="#d97706"/>
    <path d="M350 214 H436" stroke="#b45309" stroke-width="3"/>
    <rect x="372" y="220" width="42" height="16" rx="4" fill="#fef3c7"/>
    <text x="393" y="232" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#78350f">PALLET</text>
    <circle cx="464" cy="150" r="8" fill="#fbbf24"/>
    <circle cx="464" cy="176" r="8" fill="#22d3ee"/>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="34" y="34" width="260" height="68" rx="18" fill="#ffffff" opacity=".92"/>
    <text x="56" y="63" font-size="21" font-weight="700" fill="#431407">%s</text>
    <text x="56" y="85" font-size="11" letter-spacing="1.4" fill="#7c2d12">%s</text>
  </g>
  <g stroke="%s" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75">
    <path d="M542 372 h58"/><path d="M562 352 l24 20 -24 20"/>
  </g>
</svg>
""".formatted(title, body, accent, dark, dark, title, subtitle, dark);
    }

    private static String agvTugger(String body, String accent, String dark, String title, String subtitle) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-labelledby="title">
  <title id="title">%s</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#faf5ff"/><stop offset="1" stop-color="#ede9fe"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="cart" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="11" stdDeviation="9" flood-color="#2e1065" flood-opacity=".24"/></filter>
  </defs>
  <rect width="640" height="480" rx="28" fill="url(#bg)"/>
  <circle cx="86" cy="82" r="90" fill="#ddd6fe" opacity=".55"/>
  <circle cx="560" cy="408" r="108" fill="#c4b5fd" opacity=".35"/>
  <path d="M36 394 H604" stroke="#7c3aed" stroke-width="2" opacity=".25"/>
  <g stroke="#a78bfa" stroke-width="1" opacity=".35">
    <path d="M64 394 L190 342"/><path d="M148 394 L274 342"/><path d="M232 394 L358 342"/>
    <path d="M316 394 L442 342"/><path d="M400 394 L526 342"/>
  </g>
  <ellipse cx="322" cy="392" rx="260" ry="28" fill="#2e1065" opacity=".18" filter="url(#soft)"/>
  <g filter="url(#shadow)">
    <g>
      <rect x="62" y="318" width="62" height="58" rx="20" fill="#111827"/>
      <rect x="204" y="318" width="62" height="58" rx="20" fill="#111827"/>
      <circle cx="93" cy="347" r="16" fill="#374151"/>
      <circle cx="235" cy="347" r="16" fill="#374151"/>
      <path d="M58 250 Q62 236 82 234 L206 234 Q226 236 230 252 L240 318 Q242 334 224 336 L72 336 Q56 334 56 320 Z" fill="url(#body)" stroke="%s" stroke-width="3"/>
      <path d="M78 210 Q82 196 102 196 L190 196 Q212 197 218 212 L226 234 L70 234 Z" fill="%s" opacity=".55"/>
      <rect x="82" y="252" width="64" height="24" rx="10" fill="#0f172a"/>
      <circle cx="100" cy="264" r="6" fill="#22d3ee"/>
      <path d="M218 174 V212" stroke="#1f2937" stroke-width="6" stroke-linecap="round"/>
      <circle cx="218" cy="168" r="8" fill="#ef4444"/>
      <text x="146" y="306" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#ede9fe" opacity=".9">TUG</text>
    </g>
    <path d="M244 318 H300" stroke="%s" stroke-width="10" stroke-linecap="round"/>
    <g>
      <circle cx="332" cy="342" r="26" fill="#111827"/><circle cx="332" cy="342" r="10" fill="#94a3b8"/>
      <circle cx="540" cy="342" r="26" fill="#111827"/><circle cx="540" cy="342" r="10" fill="#94a3b8"/>
      <rect x="286" y="286" width="288" height="44" rx="12" fill="url(#cart)" stroke="#94a3b8" stroke-width="2"/>
      <rect x="306" y="256" width="96" height="38" rx="5" fill="#a16207"/>
      <path d="M306 268 H402" stroke="#854d0e" stroke-width="3"/>
      <rect x="420" y="248" width="112" height="46" rx="5" fill="#b45309"/>
      <path d="M420 262 H532" stroke="#92400e" stroke-width="3"/>
      <text x="476" y="282" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700" fill="#fef3c7">CARGO</text>
    </g>
    <path d="M574 318 H610" stroke="%s" stroke-width="10" stroke-linecap="round"/>
    <g>
      <circle cx="594" cy="344" r="22" fill="#111827"/><circle cx="594" cy="344" r="8" fill="#94a3b8"/>
      <rect x="560" y="296" width="62" height="38" rx="10" fill="url(#cart)" stroke="#94a3b8" stroke-width="2"/>
    </g>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="34" y="34" width="256" height="68" rx="18" fill="#ffffff" opacity=".92"/>
    <text x="56" y="63" font-size="21" font-weight="700" fill="#2e1065">%s</text>
    <text x="56" y="85" font-size="11" letter-spacing="1.4" fill="#6d28d9">%s</text>
  </g>
  <g stroke="#7c3aed" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7">
    <path d="M52 372 h58"/><path d="M72 352 l-20 20 20 20"/>
  </g>
</svg>
""".formatted(title, body, accent, dark, dark, dark, dark, title, subtitle);
    }

    private static String amrRobot(String body, String accent, String dark, String title, String subtitle) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480" role="img" aria-labelledby="title">
  <title id="title">%s</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0f9ff"/><stop offset="1" stop-color="#e0f2fe"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#bae6fd"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0284c7" stop-opacity="0"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="13" stdDeviation="11" flood-color="#082f49" flood-opacity=".26"/></filter>
  </defs>
  <rect width="640" height="480" rx="28" fill="url(#bg)"/>
  <circle cx="556" cy="82" r="94" fill="#bae6fd" opacity=".5"/>
  <circle cx="88" cy="406" r="116" fill="#7dd3fc" opacity=".25"/>
  <path d="M36 392 H604" stroke="#0369a1" stroke-width="2" opacity=".25"/>
  <g stroke="#7dd3fc" stroke-width="1" opacity=".5">
    <path d="M70 392 L196 340"/><path d="M154 392 L280 340"/><path d="M238 392 L364 340"/>
    <path d="M322 392 L448 340"/><path d="M406 392 L532 340"/>
  </g>
  <ellipse cx="320" cy="390" rx="190" ry="30" fill="#082f49" opacity=".18" filter="url(#soft)"/>
  <g filter="url(#shadow)">
    <rect x="176" y="316" width="74" height="58" rx="20" fill="#111827"/>
    <rect x="390" y="316" width="74" height="58" rx="20" fill="#111827"/>
    <circle cx="213" cy="345" r="14" fill="#374151"/>
    <circle cx="427" cy="345" r="14" fill="#374151"/>
    <rect x="146" y="248" width="348" height="90" rx="34" fill="#1f2937"/>
    <rect x="158" y="214" width="324" height="104" rx="36" fill="url(#body)" stroke="%s" stroke-width="3"/>
    <rect x="188" y="236" width="264" height="52" rx="26" fill="#0f172a"/>
    <circle cx="218" cy="262" r="9" fill="#22d3ee"/>
    <circle cx="248" cy="262" r="9" fill="#22d3ee"/>
    <rect x="284" y="250" width="140" height="24" rx="12" fill="#1e293b"/>
    <rect x="196" y="186" width="248" height="34" rx="17" fill="url(#top)" opacity=".9"/>
    <ellipse cx="320" cy="186" rx="64" ry="19" fill="#0f172a"/>
    <rect x="258" y="156" width="124" height="30" rx="15" fill="#111827"/>
    <ellipse cx="320" cy="156" rx="62" ry="19" fill="#1e293b"/>
    <ellipse cx="320" cy="156" rx="40" ry="12" fill="#38bdf8"/>
    <ellipse cx="320" cy="156" rx="74" ry="30" fill="url(#glow)" opacity=".5"/>
    <circle cx="470" cy="282" r="10" fill="#22d3ee" opacity=".8"/>
    <circle cx="470" cy="310" r="10" fill="#f59e0b" opacity=".8"/>
    <g fill="#0f172a">
      <circle cx="186" cy="302" r="12"/><circle cx="218" cy="302" r="12"/>
      <circle cx="250" cy="302" r="12"/><circle cx="282" cy="302" r="12"/>
      <circle cx="314" cy="302" r="12"/><circle cx="346" cy="302" r="12"/>
      <circle cx="378" cy="302" r="12"/><circle cx="410" cy="302" r="12"/>
    </g>
    <text x="320" y="372" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#e0f2fe" opacity=".8">AMR-X1</text>
  </g>
  <g stroke="%s" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".7">
    <path d="M512 190 q28 34 0 68"/><path d="M492 206 q20 24 0 48"/>
    <path d="M128 190 q-28 34 0 68"/><path d="M148 206 q-20 24 0 48"/>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="34" y="34" width="266" height="68" rx="18" fill="#ffffff" opacity=".92"/>
    <text x="56" y="63" font-size="21" font-weight="700" fill="#082f49">%s</text>
    <text x="56" y="85" font-size="11" letter-spacing="1.4" fill="#0369a1">%s</text>
  </g>
  <circle cx="552" cy="402" r="10" fill="#38bdf8" opacity=".6"/>
  <circle cx="584" cy="374" r="6" fill="#0ea5e9" opacity=".5"/>
</svg>
""".formatted(title, body, accent, dark, dark, title, subtitle);
    }

    private static String icon(String label, String from, String to, String art) {
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="%s">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity=".1"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0f172a" flood-opacity=".28"/></filter>
  </defs>
  <rect width="512" height="512" rx="64" fill="url(#bg)"/>
  <circle cx="430" cy="86" r="92" fill="#ffffff" opacity=".12"/>
  <circle cx="86" cy="438" r="118" fill="#ffffff" opacity=".1"/>
  <path d="M64 404 H448" stroke="#ffffff" stroke-width="3" opacity=".22"/>
  <g filter="url(#shadow)">%s</g>
  <rect x="48" y="424" width="416" height="56" rx="18" fill="#0f172a" opacity=".55"/>
  <text x="256" y="461" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3" fill="#ffffff">%s</text>
</svg>
""".formatted(label, from, to, art, label);
    }

    private static String steelArt() {
        return """
    <g>
      <rect x="112" y="272" width="288" height="26" rx="13" fill="#94a3b8"/>
      <rect x="126" y="304" width="260" height="24" rx="12" fill="#64748b"/>
      <rect x="142" y="334" width="228" height="22" rx="11" fill="#475569"/>
      <circle cx="186" cy="220" r="66" fill="none" stroke="#334155" stroke-width="20"/>
      <circle cx="186" cy="220" r="40" fill="none" stroke="#64748b" stroke-width="14"/>
      <circle cx="186" cy="220" r="16" fill="#cbd5e1"/>
      <circle cx="324" cy="220" r="66" fill="none" stroke="#475569" stroke-width="20"/>
      <circle cx="324" cy="220" r="40" fill="none" stroke="#94a3b8" stroke-width="14"/>
      <circle cx="324" cy="220" r="16" fill="#e2e8f0"/>
      <path d="M186 154 A66 66 0 0 1 252 220" stroke="url(#sheen)" stroke-width="8" fill="none" opacity=".65"/>
      <path d="M324 154 A66 66 0 0 1 390 220" stroke="url(#sheen)" stroke-width="8" fill="none" opacity=".65"/>
      <rect x="92" y="168" width="14" height="176" rx="7" fill="#cbd5e1" transform="rotate(14 99 256)"/>
      <rect x="76" y="180" width="14" height="164" rx="7" fill="#94a3b8" transform="rotate(14 83 262)"/>
    </g>""";
    }

    private static String cementArt() {
        return """
    <g>
      <path d="M146 142 Q150 124 170 122 L342 122 Q362 124 366 142 L392 330 Q394 348 376 350 L136 350 Q118 348 120 330 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="4"/>
      <path d="M146 142 Q150 124 170 122 L342 122 Q362 124 366 142 L376 228 L136 228 Z" fill="#f8fafc" opacity=".8"/>
      <rect x="136" y="228" width="240" height="14" fill="#94a3b8" opacity=".5"/>
      <path d="M170 122 Q204 96 256 96 Q308 96 342 122" fill="none" stroke="#64748b" stroke-width="10" stroke-linecap="round"/>
      <rect x="178" y="256" width="156" height="62" rx="10" fill="#1e293b"/>
      <text x="256" y="282" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#f8fafc">PCB40</text>
      <text x="256" y="304" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" letter-spacing="2" fill="#93c5fd">CEMENT</text>
      <circle cx="366" cy="158" r="10" fill="#64748b"/>
    </g>""";
    }

    private static String brickArt() {
        return """
    <g>
      <rect x="108" y="286" width="140" height="58" rx="8" fill="#c2410c" stroke="#7c2d12" stroke-width="3"/>
      <rect x="264" y="286" width="140" height="58" rx="8" fill="#ea580c" stroke="#7c2d12" stroke-width="3"/>
      <rect x="108" y="340" width="140" height="16" rx="6" fill="#9a3412" opacity=".55"/>
      <rect x="264" y="340" width="140" height="16" rx="6" fill="#9a3412" opacity=".55"/>
      <rect x="186" y="214" width="140" height="58" rx="8" fill="#f97316" stroke="#7c2d12" stroke-width="3"/>
      <rect x="342" y="214" width="62" height="58" rx="8" fill="#fb923c" stroke="#7c2d12" stroke-width="3"/>
      <rect x="186" y="268" width="140" height="16" rx="6" fill="#9a3412" opacity=".55"/>
      <rect x="342" y="268" width="62" height="16" rx="6" fill="#9a3412" opacity=".55"/>
      <rect x="108" y="142" width="140" height="58" rx="8" fill="#fdba74" stroke="#9a3412" stroke-width="3"/>
      <rect x="264" y="142" width="140" height="58" rx="8" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
      <g fill="#7c2d12" opacity=".45">
        <circle cx="148" cy="176" r="4"/><circle cx="188" cy="176" r="4"/><circle cx="228" cy="176" r="4"/>
        <circle cx="304" cy="176" r="4"/><circle cx="344" cy="176" r="4"/><circle cx="384" cy="176" r="4"/>
        <circle cx="148" cy="248" r="4"/><circle cx="228" cy="248" r="4"/><circle cx="374" cy="248" r="4"/>
        <circle cx="148" cy="320" r="4"/><circle cx="228" cy="320" r="4"/><circle cx="344" cy="320" r="4"/>
      </g>
      <path d="M120 152 L236 196" stroke="url(#sheen)" stroke-width="8" opacity=".5"/>
    </g>""";
    }

    private static String paintArt() {
        return """
    <g>
      <path d="M150 176 L362 176 L344 360 Q342 376 326 376 L186 376 Q170 376 168 360 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="4"/>
      <ellipse cx="256" cy="176" rx="106" ry="28" fill="#94a3b8"/>
      <ellipse cx="256" cy="176" rx="88" ry="20" fill="#0e7490"/>
      <ellipse cx="256" cy="176" rx="70" ry="14" fill="#67e8f9" opacity=".9"/>
      <path d="M168 214 L344 214 L340 268 L172 268 Z" fill="#0e7490"/>
      <path d="M172 268 Q206 290 240 268 Q274 246 308 268 Q326 280 340 268 L336 300 L176 300 Z" fill="#0891b2" opacity=".85"/>
      <path d="M186 214 Q204 252 186 300" stroke="#67e8f9" stroke-width="10" fill="none" opacity=".45"/>
      <path d="M394 118 L430 96 L452 128 L414 150 Z" fill="#a16207"/>
      <rect x="398" y="140" width="18" height="150" rx="9" fill="#b45309" transform="rotate(14 407 215)"/>
      <path d="M414 286 q16 22 0 44 q-16 -22 0 -44" fill="#67e8f9" opacity=".85"/>
      <circle cx="416" cy="314" r="6" fill="#ecfeff"/>
    </g>""";
    }

    private static String electricalArt() {
        return """
    <g>
      <path d="M122 336 Q92 268 142 226 Q194 182 256 226 Q318 270 372 226 Q412 194 438 152" fill="none" stroke="#0f172a" stroke-width="22" stroke-linecap="round"/>
      <path d="M122 336 Q92 268 142 226 Q194 182 256 226 Q318 270 372 226 Q412 194 438 152" fill="none" stroke="#60a5fa" stroke-width="9" stroke-linecap="round" opacity=".65"/>
      <rect x="408" y="104" width="66" height="72" rx="16" fill="#1e293b" transform="rotate(28 441 140)"/>
      <rect x="414" y="84" width="14" height="34" rx="6" fill="#cbd5e1" transform="rotate(28 421 101)"/>
      <rect x="444" y="72" width="14" height="34" rx="6" fill="#cbd5e1" transform="rotate(28 451 89)"/>
      <path d="M256 122 L214 218 L258 218 L228 306 L318 196 L270 196 L302 122 Z" fill="#facc15" stroke="#a16207" stroke-width="4"/>
      <circle cx="128" cy="334" r="22" fill="#1e293b"/>
      <circle cx="128" cy="334" r="9" fill="#60a5fa"/>
      <rect x="146" y="286" width="70" height="34" rx="10" fill="#1e40af" opacity=".7"/>
    </g>""";
    }

    private static String avatar(String from, String to, String light, String initials, boolean admin) {
        String badge = admin ? """
  <g>
    <path d="M392 70 L444 90 V128 Q444 166 392 188 Q340 166 340 128 V90 Z" fill="#facc15" stroke="#a16207" stroke-width="4"/>
    <path d="M368 128 L386 146 L420 108" fill="none" stroke="#78350f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  </g>""" : "";
        return """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="%s">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".4"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity=".3"/></filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="256" cy="250" r="188" fill="#ffffff" opacity=".1"/>
  <circle cx="96" cy="88" r="66" fill="#ffffff" opacity=".08"/>
  <circle cx="428" cy="432" r="88" fill="#ffffff" opacity=".08"/>
  <g filter="url(#shadow)">
    <circle cx="256" cy="196" r="76" fill="%s"/>
    <path d="M116 410 Q120 304 256 304 Q392 304 396 410 Z" fill="%s"/>
    <path d="M142 392 Q150 330 256 330 Q362 330 370 392 Z" fill="url(#sheen)"/>
  </g>
  <text x="256" y="462" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="58" font-weight="700" letter-spacing="6" fill="#ffffff">%s</text>
  <circle cx="256" cy="196" r="76" fill="none" stroke="#ffffff" stroke-width="6" opacity=".35"/>
%s
</svg>
""".formatted(initials, from, to, light, light, initials, badge);
    }
}
