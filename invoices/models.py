from django.db import models
from django.conf import settings
from django.db.models import Sum
from decimal import Decimal

# Create your models here.

class StaffProfile(models.Model):
    """
    Extends Django's built-in User with a CRM role. One-to-one, same idea as
    a C# "UserProfile : ApplicationUser" pattern — auth (login/password) stays
    on the built-in User model, this just tacks on the extra column.
    Role slugs match the partner's frontend exactly (her code is source of
    truth per your instruction) — NOT the admin/project_manager/operator
    slugs from the earlier draft.
    """
    ROLE_CHOICES = [
        ('administrator', 'Administrator'),
        ('auction_manager', 'Auction Manager'),
        ('finance_manager', 'Finance Manager'),
        ('call_operator', 'CRM / Call Center Officer'),
        ('viewer', 'Viewer'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user.get_username()} ({self.role})"


class ImportBatch(models.Model):

    """
    One upload of bid_data_report.xlsx = one ImportBatch.
    Winner and Invoice both point back to this so you can always answer
    "which upload did this invoice come from" and re-group by batch.
    Think of this like a C# "ImportJob" record you'd log before processing a file.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ]

    fileName = models.CharField(max_length=255)
    batchName = models.CharField(max_length=200, blank=True)
    companyName = models.CharField(max_length=200)
    auctionDate = models.DateField()
    uploadDate = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    totalRecords = models.IntegerField(default=0)
    validRecords = models.IntegerField(default=0)
    invalidRecords = models.IntegerField(default=0)
    importedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='import_batches'
    )

    def __str__(self):
        return self.batchName or self.fileName


class FeeConfig(models.Model):
    """
    Holds the default processing-fee percentage (0.95%).
    Only one row should have is_active=True at a time — enforce that in the
    admin/serializer save logic (flip old active row off before saving new one),
    not with a DB constraint, since you want history of past configs.
    """
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.95'))
    configured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    configured_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.percentage}% ({'active' if self.is_active else 'inactive'})"

    @classmethod
    def get_active_percentage(cls):
        active = cls.objects.filter(is_active=True).first()
        return active.percentage if active else Decimal('0.95')


class Auction(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    seller_name = models.CharField(max_length=255)
    auctionName = models.CharField(max_length=300)
    auctionDate = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    createdAt = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.auctionName


class Winner(models.Model):
    bidderName = models.CharField(max_length=255)
    companyName = models.CharField(max_length=200, blank=True)  # always optional, filled in manually after import
    winnerPhone = models.CharField(max_length=20)
    winnerEmail = models.EmailField(blank=True,default='')  # dropped null=True — see note above
    auction = models.ForeignKey(
        Auction, on_delete=models.SET_NULL, null=True, blank=True, related_name='winners'
    )
    importBatch = models.ForeignKey(
        ImportBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='winners'
    )
    winningAmount = models.DecimalField(max_digits=15, decimal_places=2)
    cpoAmount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cpoBank = models.CharField(max_length=100, blank=True)
    submittedAt = models.DateTimeField(null=True, blank=True)
    initialPrice = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    createdAt = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.bidderName} - {self.winningAmount}"


class Invoice(models.Model):
    """
    One Invoice per (winner, importBatch) pair — created when staff confirms
    the import preview. feePercentage lives on InvoiceLot now, not here,
    because different lots on the same invoice can carry different negotiated
    rates. totalAmount is a computed property (sum of lots), not a stored
    column — see explanation above.
    """
    STATUS_CHOICES = [
        ('invoice_generated', 'Invoice Generated'),
        ('pending_payment', 'Pending Payment'),
        ('payment_submitted', 'Payment Submitted'),
        ('under_verification', 'Under Verification'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
        ('waived', 'Waived'),
    ]

    winner = models.ForeignKey(Winner, on_delete=models.CASCADE, related_name='invoices')
    importBatch = models.ForeignKey(
        ImportBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices'
    )
    invoiceNumber = models.CharField(max_length=50, unique=True)
    invoiceDate = models.DateField()
    dueDate = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='invoice_generated')
    remarks = models.TextField(blank=True, default='')
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    @property
    def totalAmount(self):
        return self.lots.aggregate(total=Sum('lotFee'))['total'] or Decimal('0.00')

    def __str__(self):
        return f"{self.invoiceNumber} - {self.winner.bidderName}"


class InvoiceLot(models.Model):
    """
    One row per lot won, under a single Invoice. lotFee is auto-calculated
    on save from winningAmount * feePercentage — same idea as overriding a
    setter/property in C#: callers never compute lotFee themselves, save()
    does it for them so it can never drift out of sync with the inputs.
    """
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lots')
    lotNumber = models.CharField(max_length=50)
    auctionName = models.CharField(max_length=300)
    initialPrice = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    winningAmount = models.DecimalField(max_digits=15, decimal_places=2)
    cpoAmount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cpoBank = models.CharField(max_length=100, blank=True)
    feePercentage = models.DecimalField(max_digits=5, decimal_places=2)
    lotFee = models.DecimalField(max_digits=15, decimal_places=2, editable=False)
    submittedAt = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        self.lotFee = (self.winningAmount * self.feePercentage / Decimal('100')).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.lotNumber} — fee {self.lotFee}"


class Payment(models.Model):
    """
    A record of a payment CLAIM against an invoice — entered manually by
    Finance after checking the bank/Telebirr statement themselves. Nothing
    here talks to CBE or Telebirr. paymentStatus is Payment's own
    pending/verified/rejected flag; it's separate from Invoice.status,
    which only Finance/Admin move via the transition rules.
    """
    METHOD_CHOICES = [
        ('bank_transfer', 'Bank Transfer'),
        ('telebirr', 'Telebirr'),
        ('cpo', 'CPO'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amountPaid = models.DecimalField(max_digits=15, decimal_places=2)
    paymentMethod = models.CharField(max_length=20, choices=METHOD_CHOICES)
    paymentDate = models.DateField()
    uploadedAt = models.DateTimeField(auto_now_add=True)
    verifiedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verified_payments'
    )
    verifiedDate = models.DateTimeField(null=True, blank=True)
    paymentStatus = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    remarks = models.TextField(blank=True)

    def __str__(self):
        return f"{self.amountPaid} on {self.invoice.invoiceNumber}"


class Attachment(models.Model):
    DOC_TYPE_CHOICES = [
        ('bank_slip', 'Bank Slip'),
        ('transfer_proof', 'Transfer Proof'),
        ('cpo', 'CPO Document'),
        ('invoice', 'Invoice Document'),
        ('payment_confirmation', 'Payment Confirmation'),
        ('supporting_document', 'Supporting Document'),
        ('other', 'Other'),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='attachments')
    fileName = models.CharField(max_length=255)
    filePath = models.FileField(upload_to='attachments/')  # S3 once boto3/django-storages creds land
    fileExtension = models.CharField(max_length=10, blank=True)
    documentType = models.CharField(max_length=30, choices=DOC_TYPE_CHOICES, default='other')
    uploadDate = models.DateTimeField(auto_now_add=True)
    fileSize = models.DecimalField(max_digits=10, decimal_places=2, help_text="KB")
    uploadedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    def __str__(self):
        return self.fileName


class AuditLog(models.Model):
    """
    Append-only trail. Every status change, payment verification, due-date
    extension, etc. writes one of these — you'll hook this into the views
    at step 16, not here. userRole is a snapshot string (not a live FK to
    StaffProfile) on purpose: if someone's role changes later, the log
    should still say what role they held *at the time* of the action.
    """
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=255)
    performedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    userRole = models.CharField(max_length=30, blank=True)
    previousValue = models.CharField(max_length=100, blank=True)
    newValue = models.CharField(max_length=100, blank=True)
    reason = models.TextField(blank=True)
    actionDate = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.invoice.invoiceNumber}: {self.action}"