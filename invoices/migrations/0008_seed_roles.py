from django.db import migrations

BUILT_IN_ROLES = [
    {
        'name': 'Administrator',
        'isBuiltIn': True,
        'defaultPrivileges': [
            'view_invoices', 'edit_invoice', 'generate_invoice', 'change_status_generic',
            'verify_payment', 'import_batches', 'view_reports', 'view_audit',
            'manage_call_center', 'view_call_center_dashboard', 'manage_users',
        ],
    },
    {
        'name': 'Auction Manager',
        'isBuiltIn': True,
        'defaultPrivileges': [
            'view_invoices', 'edit_invoice', 'generate_invoice', 'import_batches',
            'view_reports', 'view_audit',
        ],
    },
    {
        'name': 'Finance Manager',
        'isBuiltIn': True,
        'defaultPrivileges': [
            'view_invoices', 'change_status_generic', 'verify_payment',
            'view_reports', 'view_audit',
        ],
    },
    {
        'name': 'CRM / Call Center Officer',
        'isBuiltIn': True,
        'defaultPrivileges': [
            'manage_call_center', 'view_call_center_dashboard', 'view_reports',
        ],
    },
    {
        'name': 'Viewer',
        'isBuiltIn': True,
        'defaultPrivileges': ['view_invoices', 'view_audit'],
    },
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model('invoices', 'Role')
    for entry in BUILT_IN_ROLES:
        Role.objects.get_or_create(
            name=entry['name'],
            defaults={
                'defaultPrivileges': entry['defaultPrivileges'],
                'isBuiltIn': entry['isBuiltIn'],
            },
        )


def unseed_roles(apps, schema_editor):
    Role = apps.get_model('invoices', 'Role')
    Role.objects.filter(name__in=[r['name'] for r in BUILT_IN_ROLES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0007_role'),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]