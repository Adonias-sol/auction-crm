from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0006_invoice_callnotes'),
    ]

    operations = [
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('defaultPrivileges', models.JSONField(blank=True, default=list)),
                ('isBuiltIn', models.BooleanField(default=False)),
                ('createdAt', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]