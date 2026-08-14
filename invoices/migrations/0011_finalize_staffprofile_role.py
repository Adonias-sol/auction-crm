import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0010_populate_staffprofile_rolenew'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='staffprofile',
            name='role',
        ),
        migrations.RenameField(
            model_name='staffprofile',
            old_name='roleNew',
            new_name='role',
        ),
        migrations.AlterField(
            model_name='staffprofile',
            name='role',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='staff', to='invoices.role',
            ),
        ),
    ]