from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0011_finalize_staffprofile_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog',
            name='actionType',
            field=models.CharField(
                blank=True, default='other', max_length=40,
                choices=[
                    ('change_status', 'Status changed'),
                    ('generate_invoice_pdf', 'Generate invoice PDF'),
                    ('extend_due_date', 'Extend due date'),
                    ('upload_payment', 'Payment uploaded'),
                    ('add_call_note', 'Call center note updated'),
                    ('other', 'Other'),
                ],
            ),
        ),
    ]