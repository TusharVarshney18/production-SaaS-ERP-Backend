import { AIException } from './ai.exception';

export class ConfigurationException extends AIException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message || 'AI configuration error', 'CONFIGURATION_ERROR', 500, details);
    this.name = 'ConfigurationException';
  }
}
