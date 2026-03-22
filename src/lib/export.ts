export function toCsvRows(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return "";
  }

  const first = rows[0];
  if (!first) {
    return "";
  }

  const headers = Object.keys(first);
  const headerLine = headers.join(",");
  const lines = rows.map((row) => headers.map((key) => {
    const value = row[key];
    const raw = value === null || value === undefined ? "" : String(value);
    if (raw.includes(",") || raw.includes("\n") || raw.includes("\"")) {
      return `"${raw.replaceAll("\"", "\"\"")}"`;
    }
    return raw;
  }).join(","));

  return [headerLine, ...lines].join("\n");
}
