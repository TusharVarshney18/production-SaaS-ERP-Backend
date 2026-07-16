import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  MetadataService,
  AI_TOOL_KEY,
  AI_CAPABILITY_KEY,
  AI_PERMISSION_KEY,
  AI_METADATA_KEY,
  AI_PROVIDER_SUPPORT_KEY,
} from '../registry/metadata/metadata.service';

describe('MetadataService', () => {
  let service: MetadataService;

  @Reflect.metadata(AI_TOOL_KEY, {
    name: 'test-tool',
    description: 'A test tool',
    category: 'test',
  })
  class TestToolClass {}

  @Reflect.metadata(AI_CAPABILITY_KEY, {
    name: 'test-capability',
    description: 'A test capability',
  })
  class TestCapabilityClass {}

  @Reflect.metadata(AI_PERMISSION_KEY, { permissions: ['sales:read'] })
  class TestPermissionClass {}

  @Reflect.metadata(AI_PROVIDER_SUPPORT_KEY, ['openai', 'claude'])
  class TestProviderClass {}

  @Reflect.metadata(AI_METADATA_KEY, [{ key: 'customKey', value: 'customValue' }])
  class TestCustomMetadataClass {}

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataService, Reflector],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
  });

  it('should get tool metadata from class', () => {
    const meta = service.getToolMetadata(TestToolClass);
    expect(meta).toBeDefined();
    expect(meta?.name).toBe('test-tool');
    expect(meta?.description).toBe('A test tool');
  });

  it('should return undefined for class without tool metadata', () => {
    const meta = service.getToolMetadata(class PlainClass {});
    expect(meta).toBeUndefined();
  });

  it('should get capability metadata from class', () => {
    const meta = service.getCapabilityMetadata(TestCapabilityClass);
    expect(meta).toBeDefined();
    expect(meta?.name).toBe('test-capability');
  });

  it('should get permission metadata from class', () => {
    const meta = service.getPermissionMetadata(TestPermissionClass);
    expect(meta).toBeDefined();
    expect(meta?.permissions).toEqual(['sales:read']);
  });

  it('should get custom metadata from class', () => {
    const meta = service.getAllMetadata(TestCustomMetadataClass);
    expect(meta).toBeDefined();
    expect(meta.customKey).toBe('customValue');
  });

  it('should get provider support from class', () => {
    const providers = service.getProviderSupport(TestProviderClass);
    expect(providers).toBeDefined();
    expect(providers).toContain('openai');
    expect(providers).toContain('claude');
  });

  it('should get all class metadata combined', () => {
    const meta = service.getClassMetadata(TestToolClass);
    expect(meta.tool).toBeDefined();
    expect((meta.tool as { name: string }).name).toBe('test-tool');
  });

  it('should handle class with no metadata', () => {
    const meta = service.getClassMetadata(class EmptyClass {});
    expect(meta).toBeDefined();
    expect(Object.keys(meta).length).toBe(0);
  });
});
