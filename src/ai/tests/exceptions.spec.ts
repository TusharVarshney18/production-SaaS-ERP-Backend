import { AIException } from '../exceptions/ai.exception';
import { ProviderUnavailableException } from '../exceptions/provider-unavailable.exception';
import { InvalidProviderException } from '../exceptions/invalid-provider.exception';
import { StreamingException } from '../exceptions/streaming.exception';
import { ConfigurationException } from '../exceptions/configuration.exception';

describe('AI Exceptions', () => {
  describe('AIException', () => {
    it('should create an AI exception with default values', () => {
      const error = new AIException('Something went wrong');

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('AI_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AIException');
    });

    it('should create an AI exception with custom values', () => {
      const error = new AIException('Custom error', 'CUSTOM_CODE', 400, { detail: 'info' });

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'info' });
    });
  });

  describe('ProviderUnavailableException', () => {
    it('should create with provider name', () => {
      const error = new ProviderUnavailableException('openai');

      expect(error.message).toContain('openai');
      expect(error.message).toContain('unavailable');
      expect(error.code).toBe('PROVIDER_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
      expect(error.name).toBe('ProviderUnavailableException');
    });

    it('should include provider in details', () => {
      const error = new ProviderUnavailableException('gemini');
      expect(error.details?.provider).toBe('gemini');
    });
  });

  describe('InvalidProviderException', () => {
    it('should create with provider name and available list', () => {
      const error = new InvalidProviderException('bad_provider', ['openai', 'gemini']);

      expect(error.message).toContain('bad_provider');
      expect(error.message).toContain('openai');
      expect(error.message).toContain('gemini');
      expect(error.code).toBe('INVALID_PROVIDER');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('InvalidProviderException');
    });
  });

  describe('StreamingException', () => {
    it('should create with streaming error message', () => {
      const error = new StreamingException('Stream connection lost');

      expect(error.message).toBe('Stream connection lost');
      expect(error.code).toBe('STREAMING_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('StreamingException');
    });

    it('should use default message when none provided', () => {
      const error = new StreamingException('');
      expect(error.message).toBe('Streaming error occurred');
    });

    it('should include optional details', () => {
      const error = new StreamingException('Timeout', { chunk: 42 });
      expect(error.details).toEqual({ chunk: 42 });
    });
  });

  describe('ConfigurationException', () => {
    it('should create with configuration error message', () => {
      const error = new ConfigurationException('Missing API key');

      expect(error.message).toBe('Missing API key');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('ConfigurationException');
    });

    it('should use default message when none provided', () => {
      const error = new ConfigurationException('');
      expect(error.message).toBe('AI configuration error');
    });

    it('should include optional details', () => {
      const error = new ConfigurationException('Invalid endpoint', { provider: 'azure' });
      expect(error.details).toEqual({ provider: 'azure' });
    });
  });
});
