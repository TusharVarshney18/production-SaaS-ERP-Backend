import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PromptRegistryService } from '../registry/prompt-registry.service';
import { PromptDefinition } from '../interfaces/runtime.interface';

describe('PromptRegistryService', () => {
  let service: PromptRegistryService;

  const samplePrompt: PromptDefinition = {
    name: 'test-prompt',
    version: '1.0.0',
    template: 'Hello {{name}}, your role is {{role}}.',
    variables: [
      { name: 'name', required: true },
      { name: 'role', required: true, defaultValue: 'user' },
    ],
    category: 'test',
    description: 'A test prompt',
    tags: ['test', 'greeting'],
  };

  const samplePromptV2: PromptDefinition = {
    name: 'test-prompt',
    version: '2.0.0',
    template: 'Greetings {{name}}, you are a {{role}}.',
    variables: [
      { name: 'name', required: true },
      { name: 'role', required: true },
    ],
    category: 'test',
    description: 'A test prompt v2',
    tags: ['test', 'greeting'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptRegistryService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'ai.promptCacheTtl') return 300000;
              if (key === 'ai.promptsDir') return '';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PromptRegistryService>(PromptRegistryService);
  });

  afterEach(() => {
    service.clearCache();
  });

  it('should register a prompt', () => {
    service.register(samplePrompt);
    expect(service.get('test-prompt')).toBeDefined();
    expect(service.get('test-prompt')?.version).toBe('1.0.0');
  });

  it('should get a prompt by name and version', () => {
    service.register(samplePrompt);
    const found = service.getVersioned('test-prompt', '1.0.0');
    expect(found).toBeDefined();
    expect(found?.name).toBe('test-prompt');
  });

  it('should return undefined for unknown prompt', () => {
    expect(service.get('nonexistent')).toBeUndefined();
  });

  it('should return latest version when no version specified', () => {
    service.register(samplePrompt);
    service.register(samplePromptV2);
    const latest = service.get('test-prompt');
    expect(latest?.version).toBe('2.0.0');
  });

  it('should get all versions of a prompt', () => {
    service.register(samplePrompt);
    service.register(samplePromptV2);
    const versions = service.getAllVersions('test-prompt');
    expect(versions.length).toBe(2);
  });

  it('should get all registered prompts', () => {
    service.register(samplePrompt);
    service.register({
      ...samplePrompt,
      name: 'another-prompt',
      version: '1.0.0',
    });
    const all = service.getAll();
    expect(all.length).toBe(2);
  });

  it('should search prompts by name', () => {
    service.register(samplePrompt);
    const results = service.search('test');
    expect(results.length).toBe(1);
  });

  it('should search prompts by tag', () => {
    service.register(samplePrompt);
    const results = service.search('greeting');
    expect(results.length).toBe(1);
  });

  it('should render a prompt with variables', () => {
    service.register(samplePrompt);
    const rendered = service.render('test-prompt', { name: 'Alice', role: 'admin' });
    expect(rendered).toBe('Hello Alice, your role is admin.');
  });

  it('should throw on render when required variable missing', () => {
    service.register({
      ...samplePrompt,
      variables: [
        { name: 'name', required: true },
        { name: 'role', required: true },
      ],
    });
    expect(() => service.render('test-prompt', { name: 'Alice' })).toThrow(
      'Required variable "role" not provided',
    );
  });

  it('should use default value when optional variable not provided', () => {
    service.register(samplePrompt);
    const rendered = service.render('test-prompt', { name: 'Bob' });
    expect(rendered).toContain('user');
    expect(rendered).toContain('Bob');
  });

  it('should throw on render for unknown prompt', () => {
    expect(() => service.render('unknown', {})).toThrow('Prompt not found');
  });

  it('should validate a valid prompt', () => {
    const errors = service.validate(samplePrompt);
    expect(errors.length).toBe(0);
  });

  it('should detect missing name in validation', () => {
    const errors = service.validate({ ...samplePrompt, name: '' });
    expect(errors).toContain('Prompt name is required');
  });

  it('should detect missing template in validation', () => {
    const errors = service.validate({ ...samplePrompt, template: '' });
    expect(errors).toContain('Prompt template is required');
  });

  it('should detect undeclared variables in template', () => {
    const errors = service.validate({
      ...samplePrompt,
      template: 'Hello {{undeclaredVar}}.',
      variables: [],
    });
    expect(errors.some((e) => e.includes('undeclaredVar'))).toBe(true);
  });

  it('should detect duplicate variable declarations', () => {
    const errors = service.validate({
      ...samplePrompt,
      variables: [
        { name: 'dup', required: true },
        { name: 'dup', required: false },
      ],
    });
    expect(errors.some((e) => e.includes('dup'))).toBe(true);
  });

  it('should remove a prompt', () => {
    service.register(samplePrompt);
    expect(service.remove('test-prompt')).toBe(true);
    expect(service.get('test-prompt')).toBeUndefined();
  });

  it('should return false when removing nonexistent prompt', () => {
    expect(service.remove('nonexistent')).toBe(false);
  });

  it('should clear cache', () => {
    service.register(samplePrompt);
    service.clearCache();
    expect(service.getCacheSize()).toBe(0);
  });

  it('should report cache size', () => {
    service.register(samplePrompt);
    expect(service.getCacheSize()).toBe(1);
  });
});
