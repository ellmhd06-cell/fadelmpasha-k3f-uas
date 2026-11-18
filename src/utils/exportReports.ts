export function downloadExcelSpreadsheet(
  filename: string,
  sheetTitle: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const escapeHtml = (val: string | number) =>
    String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const headerCells = headers
    .map(
      (h) =>
        `<th style="background:#1D4ED8;color:#FFFFFF;font-weight:bold;padding:8px;border:1px solid #CBD5E1;text-align:left;">${escapeHtml(h)}</th>`,
    )
    .join('');

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:6px 8px;border:1px solid #E2E8F0;">${escapeHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8" /></head>
      <body>
        <h3>${escapeHtml(sheetTitle)}</h3>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportToPdfPrint() {
  window.print();
}
