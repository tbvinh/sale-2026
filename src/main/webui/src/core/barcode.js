/**
 * Bộ tạo mã vạch chuẩn Code 39 bằng SVG vector thuần JavaScript, không dependency.
 * Hỗ trợ tạo SVG sắc nét để in ấn tem nhãn, in hóa đơn nhiệt và tài liệu kho.
 */

const PATTERNS = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

/**
 * Sinh chuỗi SVG mã vạch Code 39
 * @param {string} text Nội dung mã (ký tự hoặc số)
 * @param {number|object} opts Chiều cao hoặc options { height, showText, narrow, wide, maxWidth }
 * @returns {string} Chuỗi SVG vector
 */
export function generateBarcodeSvg(text, opts = {}) {
  const options = typeof opts === 'number' ? { height: opts } : (opts || {});
  const height = options.height || 36;
  const showText = options.showText !== false;
  const narrow = options.narrow || 1.8;
  const wide = options.wide || (narrow * 2.3);
  const clean = String(text ?? '').toUpperCase().replace(/[^0-9A-Z\-.$/+% ]/g, '') || 'ITEM';
  const full = '*' + clean + '*';

  let x = 0;
  const bars = [];

  for (let i = 0; i < full.length; i++) {
    const char = full[i];
    const pattern = PATTERNS[char] || PATTERNS['-'];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const w = pattern[j] === '1' ? wide : narrow;
      if (isBar) {
        bars.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="#000" />`);
      }
      x += w;
    }
    x += narrow; // Khoảng cách giữa các ký tự
  }

  const totalWidth = Math.ceil(x);
  const textHeight = showText ? 14 : 0;
  const totalHeight = height + textHeight;
  const maxWidthAttr = options.maxWidth ? `max-width:${options.maxWidth}px;` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="${totalHeight}" style="display:block;margin:0 auto;shape-rendering:crispEdges;${maxWidthAttr}">
    ${bars.join('')}
    ${showText ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="600" fill="#000">${clean}</text>` : ''}
  </svg>`;
}

