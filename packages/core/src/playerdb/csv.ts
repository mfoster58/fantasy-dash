const COMMA = 44, LF = 10, CR = 13, QUOTE = 34;

/** RFC 4180 rows as objects keyed by the header line. Quoted fields may hold commas, newlines and doubled quotes. */
export function* parseCsv(text: string): Generator<Record<string, string>> {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let header: string[] | null = null;
  while (i < n) {
    const fields: string[] = [];
    let endOfLine = false;
    while (!endOfLine) {
      let field = '';
      if (text.charCodeAt(i) === QUOTE) {
        i++;
        let start = i;
        while (i < n) {
          if (text.charCodeAt(i) === QUOTE) {
            field += text.slice(start, i);
            if (text.charCodeAt(i + 1) === QUOTE) { field += '"'; i += 2; start = i; continue; }
            i++;
            break;
          }
          i++;
        }
        if (i >= n && start < i) field += text.slice(start, i);
      }
      const start = i;
      let c = 0;
      while (i < n && (c = text.charCodeAt(i)) !== COMMA && c !== LF && c !== CR) i++;
      field += text.slice(start, i);
      fields.push(field);
      if (i >= n) endOfLine = true;
      else if (c === COMMA) i++;
      else { if (c === CR) i++; if (text.charCodeAt(i) === LF) i++; endOfLine = true; }
    }
    if (fields.length === 1 && fields[0] === '') continue;
    if (!header) { header = fields; continue; }
    const row: Record<string, string> = {};
    for (let k = 0; k < header.length; k++) row[header[k]] = fields[k] ?? '';
    yield row;
  }
}
