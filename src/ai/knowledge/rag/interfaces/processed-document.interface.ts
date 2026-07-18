export interface ProcessedDocument {
  text: string;
  metadata: Record<string, unknown>;
  cleanedText: string;
}
