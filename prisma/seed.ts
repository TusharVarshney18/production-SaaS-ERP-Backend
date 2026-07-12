import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GROUPS = [
  { name: 'Sales', slug: 'sales', description: 'Sales and invoicing module', displayOrder: 1 },
  { name: 'Inventory', slug: 'inventory', description: 'Product and inventory management', displayOrder: 2 },
  { name: 'Accounting', slug: 'accounting', description: 'Financial journal and accounting', displayOrder: 3 },
  { name: 'CRM', slug: 'crm', description: 'Customer relationship management', displayOrder: 4 },
  { name: 'HRMS', slug: 'hrms', description: 'Human resource management', displayOrder: 5 },
  { name: 'Settings', slug: 'settings', description: 'Organization configuration', displayOrder: 6 },
  { name: 'System', slug: 'system', description: 'System administration', displayOrder: 7 },
];

const PERMISSIONS = [
  { groupSlug: 'sales', resource: 'invoice', action: 'create', description: 'Create invoices' },
  { groupSlug: 'sales', resource: 'invoice', action: 'read', description: 'View invoices' },
  { groupSlug: 'sales', resource: 'invoice', action: 'update', description: 'Update invoices' },
  { groupSlug: 'sales', resource: 'invoice', action: 'delete', description: 'Delete invoices' },
  { groupSlug: 'sales', resource: 'invoice', action: 'approve', description: 'Approve invoices' },
  { groupSlug: 'sales', resource: 'invoice', action: '*', description: 'Full access to invoices' },
  { groupSlug: 'inventory', resource: 'product', action: 'create', description: 'Create products' },
  { groupSlug: 'inventory', resource: 'product', action: 'read', description: 'View products' },
  { groupSlug: 'inventory', resource: 'product', action: 'update', description: 'Update products' },
  { groupSlug: 'inventory', resource: 'product', action: 'delete', description: 'Delete products' },
  { groupSlug: 'inventory', resource: 'product', action: '*', description: 'Full access to products' },
  { groupSlug: 'accounting', resource: 'journal', action: 'create', description: 'Create journal entries' },
  { groupSlug: 'accounting', resource: 'journal', action: 'read', description: 'View journal entries' },
  { groupSlug: 'accounting', resource: 'journal', action: 'update', description: 'Update journal entries' },
  { groupSlug: 'accounting', resource: 'journal', action: 'approve', description: 'Approve journal entries' },
  { groupSlug: 'accounting', resource: 'journal', action: '*', description: 'Full access to journals' },
  { groupSlug: 'crm', resource: 'lead', action: 'create', description: 'Create leads' },
  { groupSlug: 'crm', resource: 'lead', action: 'read', description: 'View leads' },
  { groupSlug: 'crm', resource: 'lead', action: 'update', description: 'Update leads' },
  { groupSlug: 'crm', resource: 'lead', action: 'delete', description: 'Delete leads' },
  { groupSlug: 'crm', resource: 'lead', action: 'assign', description: 'Assign leads to users' },
  { groupSlug: 'crm', resource: 'lead', action: '*', description: 'Full access to leads' },
  { groupSlug: 'crm', resource: 'company', action: 'create', description: 'Create companies' },
  { groupSlug: 'crm', resource: 'company', action: 'read', description: 'View companies' },
  { groupSlug: 'crm', resource: 'company', action: 'update', description: 'Update companies' },
  { groupSlug: 'crm', resource: 'company', action: 'delete', description: 'Delete companies' },
  { groupSlug: 'crm', resource: 'company', action: '*', description: 'Full access to companies' },
  { groupSlug: 'crm', resource: 'contact', action: 'create', description: 'Create contacts' },
  { groupSlug: 'crm', resource: 'contact', action: 'read', description: 'View contacts' },
  { groupSlug: 'crm', resource: 'contact', action: 'update', description: 'Update contacts' },
  { groupSlug: 'crm', resource: 'contact', action: 'delete', description: 'Delete contacts' },
  { groupSlug: 'crm', resource: 'contact', action: '*', description: 'Full access to contacts' },
  { groupSlug: 'crm', resource: 'pipeline', action: 'create', description: 'Create pipelines' },
  { groupSlug: 'crm', resource: 'pipeline', action: 'read', description: 'View pipelines' },
  { groupSlug: 'crm', resource: 'pipeline', action: 'update', description: 'Update pipelines' },
  { groupSlug: 'crm', resource: 'pipeline', action: 'delete', description: 'Delete pipelines' },
  { groupSlug: 'crm', resource: 'pipeline', action: '*', description: 'Full access to pipelines' },
  { groupSlug: 'crm', resource: 'deal', action: 'create', description: 'Create deals' },
  { groupSlug: 'crm', resource: 'deal', action: 'read', description: 'View deals' },
  { groupSlug: 'crm', resource: 'deal', action: 'update', description: 'Update deals' },
  { groupSlug: 'crm', resource: 'deal', action: 'delete', description: 'Delete deals' },
  { groupSlug: 'crm', resource: 'deal', action: '*', description: 'Full access to deals' },
  { groupSlug: 'crm', resource: 'activity', action: 'create', description: 'Create activities' },
  { groupSlug: 'crm', resource: 'activity', action: 'read', description: 'View activities' },
  { groupSlug: 'crm', resource: 'activity', action: 'update', description: 'Update activities' },
  { groupSlug: 'crm', resource: 'activity', action: 'delete', description: 'Delete activities' },
  { groupSlug: 'crm', resource: 'activity', action: '*', description: 'Full access to activities' },
  { groupSlug: 'inventory', resource: 'product', action: 'create', description: 'Create products' },
  { groupSlug: 'inventory', resource: 'product', action: 'read', description: 'View products' },
  { groupSlug: 'inventory', resource: 'product', action: 'update', description: 'Update products' },
  { groupSlug: 'inventory', resource: 'product', action: 'delete', description: 'Delete products' },
  { groupSlug: 'inventory', resource: 'product', action: '*', description: 'Full access to products' },
  { groupSlug: 'inventory', resource: 'category', action: 'create', description: 'Create categories' },
  { groupSlug: 'inventory', resource: 'category', action: 'read', description: 'View categories' },
  { groupSlug: 'inventory', resource: 'category', action: 'update', description: 'Update categories' },
  { groupSlug: 'inventory', resource: 'category', action: 'delete', description: 'Delete categories' },
  { groupSlug: 'inventory', resource: 'category', action: '*', description: 'Full access to categories' },
  { groupSlug: 'inventory', resource: 'unit', action: 'create', description: 'Create units' },
  { groupSlug: 'inventory', resource: 'unit', action: 'read', description: 'View units' },
  { groupSlug: 'inventory', resource: 'unit', action: 'update', description: 'Update units' },
  { groupSlug: 'inventory', resource: 'unit', action: 'delete', description: 'Delete units' },
  { groupSlug: 'inventory', resource: 'unit', action: '*', description: 'Full access to units' },
  { groupSlug: 'hrms', resource: 'employee', action: 'create', description: 'Create employee records' },
  { groupSlug: 'hrms', resource: 'employee', action: 'read', description: 'View employee records' },
  { groupSlug: 'hrms', resource: 'employee', action: 'update', description: 'Update employee records' },
  { groupSlug: 'hrms', resource: 'employee', action: 'delete', description: 'Delete employee records' },
  { groupSlug: 'hrms', resource: 'employee', action: '*', description: 'Full access to employee records' },
  { groupSlug: 'settings', resource: 'organization', action: 'read', description: 'View organization settings' },
  { groupSlug: 'settings', resource: 'organization', action: 'update', description: 'Update organization settings' },
  { groupSlug: 'settings', resource: 'organization', action: '*', description: 'Full access to organization settings' },
  { groupSlug: 'system', resource: 'user', action: 'create', description: 'Create users' },
  { groupSlug: 'system', resource: 'user', action: 'read', description: 'View users' },
  { groupSlug: 'system', resource: 'user', action: 'update', description: 'Update users' },
  { groupSlug: 'system', resource: 'user', action: 'delete', description: 'Delete users' },
  { groupSlug: 'system', resource: 'user', action: 'invite', description: 'Invite users' },
  { groupSlug: 'system', resource: 'user', action: '*', description: 'Full access to users' },
  { groupSlug: 'system', resource: 'role', action: 'create', description: 'Create roles' },
  { groupSlug: 'system', resource: 'role', action: 'read', description: 'View roles' },
  { groupSlug: 'system', resource: 'role', action: 'update', description: 'Update roles' },
  { groupSlug: 'system', resource: 'role', action: 'delete', description: 'Delete roles' },
  { groupSlug: 'system', resource: 'role', action: '*', description: 'Full access to roles' },
  { groupSlug: 'system', resource: 'permission', action: 'read', description: 'View permissions' },
  { groupSlug: 'system', resource: 'audit_log', action: 'read', description: 'View audit logs' },
];

const DEFAULT_ROLE_TEMPLATES = [
  {
    slug: 'owner',
    name: 'Owner',
    description: 'Full system access. Exactly one per organization. Immutable.',
    isSystem: true,
    isOwner: true,
  },
  {
    slug: 'admin',
    name: 'Admin',
    description: 'Administrative access with full control over settings and users.',
    isSystem: true,
    isOwner: false,
    permissionFilter: '*',
  },
  {
    slug: 'manager',
    name: 'Manager',
    description: 'Departmental management access.',
    isSystem: true,
    isOwner: false,
    permissionFilter: [
      'invoice:*',
      'product:*',
      'lead:*',
      'company:*',
      'contact:*',
      'deal:*',
      'pipeline:*',
      'activity:*',
      'product:*',
      'employee:read',
      'user:read',
      'role:read',
      'permission:read',
      'audit_log:read',
    ],
  },
  {
    slug: 'employee',
    name: 'Employee',
    description: 'Basic self-service access.',
    isSystem: true,
    isOwner: false,
    permissionFilter: [
      'invoice:read',
      'product:read',
      'lead:read',
      'employee:read',
    ],
  },
];

async function seedPermissionGroups() {
  const groupIdMap = new Map<string, string>();
  for (const group of GROUPS) {
    const record = await prisma.permissionGroup.upsert({
      where: { slug: group.slug },
      create: group,
      update: { name: group.name, description: group.description, displayOrder: group.displayOrder },
    });
    groupIdMap.set(group.slug, record.id);
  }
  console.log(`  ✓ Seeded ${groupIdMap.size} permission groups`);
  return groupIdMap;
}

async function seedPermissions(groupIdMap: Map<string, string>) {
  let count = 0;
  for (const perm of PERMISSIONS) {
    const groupId = groupIdMap.get(perm.groupSlug);
    if (!groupId) {
      console.warn(
        `  ⚠ Skipping permission "${perm.resource}:${perm.action}" — group "${perm.groupSlug}" not found`,
      );
      continue;
    }
    await prisma.permission.upsert({
      where: {
        resource_action: { resource: perm.resource, action: perm.action },
      },
      create: {
        groupId,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
      update: {
        groupId,
        description: perm.description,
      },
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} permissions`);
  return groupIdMap;
}

async function main() {
  console.log('── Seeding database ──\n');
  console.log('1. Permission Groups & Permissions');
  const groupIdMap = await seedPermissionGroups();
  await seedPermissions(groupIdMap);
  console.log('\n2. Default Role Templates (reference)');
  console.log('   Role templates defined for onboarding service:');
  for (const template of DEFAULT_ROLE_TEMPLATES) {
    console.log(`   - ${template.name} (${template.slug})`);
  }
  console.log('   (Roles are created per-organization during onboarding, not seeded globally.)\n');
  console.log('── Seed complete ──');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
