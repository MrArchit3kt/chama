/** Génère un CSV (compatible Excel) à partir de lignes de cellules. */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const UTF8_BOM = "﻿";

export function toCsv(rows: (string | number)[][]): string {
  const body = rows.map((row) => row.map((cell) => escapeCsvField(String(cell))).join(",")).join("\r\n");
  // Sans le BOM, Excel affiche mal les accents à l'ouverture directe du fichier.
  return `${UTF8_BOM}${body}`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
