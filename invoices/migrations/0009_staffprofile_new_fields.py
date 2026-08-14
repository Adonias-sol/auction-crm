import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0008_seed_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffprofile',
            name='privileges',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='staffprofile',
            name='isActive',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='staffprofile',
            name='lastPasswordChange',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='staffprofile',
            name='lastUsernameChange',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='staffprofile',
            name='roleNew',
            field=models.ForeignKey(
                null=True, blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='staff', to='invoices.role',
            ),
        ),
    ]