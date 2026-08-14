from django.db import migrations

ROLE_SLUG_TO_NAME = {
    'administrator': 'Administrator',
    'auction_manager': 'Auction Manager',
    'finance_manager': 'Finance Manager',
    'call_operator': 'CRM / Call Center Officer',
    'viewer': 'Viewer',
}


def populate_rolenew(apps, schema_editor):
    StaffProfile = apps.get_model('invoices', 'StaffProfile')
    Role = apps.get_model('invoices', 'Role')

    roles_by_name = {r.name: r for r in Role.objects.all()}

    for profile in StaffProfile.objects.all():
        role_name = ROLE_SLUG_TO_NAME.get(profile.role)
        role = roles_by_name.get(role_name) if role_name else None
        if role is None:
            # Unknown/legacy role string — fall back to Viewer so nobody
            # accidentally ends up with elevated access from a null FK.
            role = roles_by_name.get('Viewer')
        profile.roleNew = role
        profile.privileges = list(role.defaultPrivileges) if role else []
        profile.save(update_fields=['roleNew', 'privileges'])


def reverse_noop(apps, schema_editor):
    # roleNew and privileges get dropped/removed in a later migration
    # anyway when this whole change is reversed — nothing to undo here.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0009_staffprofile_new_fields'),
    ]

    operations = [
        migrations.RunPython(populate_rolenew, reverse_noop),
    ]