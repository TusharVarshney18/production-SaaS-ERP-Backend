import { Injectable } from '@nestjs/common';

@Injectable()
export class ExportService {
  toCsv(data: Record<string, unknown>[], columns?: string[]): string {
    if (data.length === 0) return '';
    const headers = columns || Object.keys(data[0]);
    const escapeCsv = (val: unknown): string => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const headerRow = headers.join(',');
    const rows = data.map((row) => headers.map((h) => escapeCsv(row[h])).join(','));
    return [headerRow, ...rows].join('\n');
  }

  toExcelXml(data: Record<string, unknown>[], title = 'Report'): string {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const xmlRows = data.map((row) => {
      const cells = headers
        .map((h) => {
          const val = row[h] ?? '';
          return `<Cell><Data ss:Type="String">${String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    });
    const headerCells = headers
      .map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`)
      .join('');
    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${title}">
  <Table>
   <Row>${headerCells}</Row>
   ${xmlRows.join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;
  }

  toPdfHtml(data: Record<string, unknown>[], title = 'Report'): string {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
    const bodyRows = data
      .map((row) => {
        const cells = headers.map((h) => `<td>${row[h] ?? ''}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style>
</head><body><h1>${title}</h1><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  }
}
