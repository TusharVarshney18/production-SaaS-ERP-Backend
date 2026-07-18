export interface ParsedDocument {
  text: string;
  metadata: Record<string, unknown>;
}

export interface IDocumentParser {
  readonly supportedMimeTypes: string[];
  parse(buffer: Buffer, mimeType: string): Promise<ParsedDocument>;
}
