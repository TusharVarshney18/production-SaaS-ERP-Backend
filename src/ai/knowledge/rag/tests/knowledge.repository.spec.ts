import { KnowledgeRepository } from '../repositories/knowledge.repository';

describe('KnowledgeRepository', () => {
  let repo: KnowledgeRepository;

  beforeEach(() => {
    repo = new KnowledgeRepository();
  });

  it('should create and retrieve a document', async () => {
    const doc = {
      id: '1',
      organizationId: 'org1',
      uploadedBy: 'user1',
      fileName: 'test.txt',
      fileSize: 100,
      mimeType: 'text/plain',
      source: 'upload' as const,
      status: 'pending' as const,
      metadata: {},
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.createDocument(doc);
    const fetched = await repo.getDocument('1');
    expect(fetched).toBeTruthy();
    expect(fetched!.fileName).toBe('test.txt');
  });

  it('should update document status', async () => {
    const doc = {
      id: '1',
      organizationId: 'org1',
      uploadedBy: 'user1',
      fileName: 'test.txt',
      fileSize: 100,
      mimeType: 'text/plain',
      source: 'upload' as const,
      status: 'pending' as const,
      metadata: {},
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.createDocument(doc);
    await repo.updateDocument('1', { status: 'indexed' });

    const updated = await repo.getDocument('1');
    expect(updated).toBeTruthy();
    expect(updated!.status).toBe('indexed');
  });

  it('should list documents by organization', async () => {
    await repo.createDocument({
      id: '1',
      organizationId: 'org1',
      uploadedBy: 'u1',
      fileName: 'a.txt',
      fileSize: 10,
      mimeType: 'text/plain',
      source: 'upload',
      status: 'indexed',
      metadata: {},
      version: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });
    await repo.createDocument({
      id: '2',
      organizationId: 'org1',
      uploadedBy: 'u1',
      fileName: 'b.txt',
      fileSize: 10,
      mimeType: 'text/plain',
      source: 'upload',
      status: 'indexed',
      metadata: {},
      version: 1,
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02',
    });
    await repo.createDocument({
      id: '3',
      organizationId: 'org2',
      uploadedBy: 'u2',
      fileName: 'c.txt',
      fileSize: 10,
      mimeType: 'text/plain',
      source: 'upload',
      status: 'indexed',
      metadata: {},
      version: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    const org1Docs = await repo.listDocuments('org1');
    expect(org1Docs).toHaveLength(2);

    const org2Docs = await repo.listDocuments('org2');
    expect(org2Docs).toHaveLength(1);
  });

  it('should count documents', async () => {
    await repo.createDocument({
      id: '1',
      organizationId: 'org1',
      uploadedBy: 'u1',
      fileName: 'a.txt',
      fileSize: 10,
      mimeType: 'text/plain',
      source: 'upload',
      status: 'indexed',
      metadata: {},
      version: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    expect(await repo.countDocuments('org1')).toBe(1);
    expect(await repo.countDocuments('org1', 'indexed')).toBe(1);
    expect(await repo.countDocuments('org1', 'pending')).toBe(0);
  });

  it('should manage versions', async () => {
    await repo.addVersion({
      id: 'v1',
      documentId: 'd1',
      organizationId: 'org1',
      version: 1,
      fileHash: 'abc',
      chunkCount: 5,
      status: 'indexed',
      createdAt: '2024-01-01',
    });
    await repo.addVersion({
      id: 'v2',
      documentId: 'd1',
      organizationId: 'org1',
      version: 2,
      fileHash: 'def',
      chunkCount: 10,
      status: 'indexed',
      createdAt: '2024-01-02',
    });

    const versions = await repo.getVersions('d1');
    expect(versions).toHaveLength(2);

    const latest = await repo.getLatestVersion('d1');
    expect(latest).toBeTruthy();
    expect(latest!.version).toBe(2);
  });
});
