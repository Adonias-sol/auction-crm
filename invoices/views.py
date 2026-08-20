from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import FileResponse
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response    
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from .pagination import StandardPagination
from io import BytesIO
from decimal import Decimal

from .audit import log_audit
import base64
import os
from django.conf import settings

from .models import (
    Auction, Winner, Invoice, InvoiceLot, Payment, Attachment, FeeConfig, AuditLog,OfficeSettings,
)
from .serializers import (
    AuctionSerializer, WinnerSerializer, InvoiceListSerializer,
    InvoiceDetailSerializer, PaymentSerializer, AttachmentSerializer,
    AuditLogSerializer, FeeConfigSerializer, LoginSerializer,OfficeSettingsSerializer,
)
from .permissions import ReadOnlyForViewer, ActionPermissionMap, can_transition, has_permission




def _join_amharic_list(items):
        """'A' / 'A እና B' / 'A, B እና C' — Amharic-style list joining."""
        items = [str(i) for i in items]
        if not items:
            return ""
        if len(items) == 1:
            return items[0]
        if len(items) == 2:
            return f"{items[0]} እና {items[1]}"
        return ", ".join(items[:-1]) + f" እና {items[-1]}"

class AuctionViewSet(viewsets.ModelViewSet):
    queryset = Auction.objects.all().order_by('-auctionDate')
    serializer_class = AuctionSerializer
    permission_classes = [IsAuthenticated, ReadOnlyForViewer]
    pagination_class = StandardPagination


class WinnerViewSet(viewsets.ModelViewSet):
    queryset = Winner.objects.select_related('auction', 'importBatch').order_by('-createdAt')
    serializer_class = WinnerSerializer
    permission_classes = [IsAuthenticated, ReadOnlyForViewer]
    pagination_class = StandardPagination


class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, ReadOnlyForViewer, ActionPermissionMap]
    pagination_class = StandardPagination
    action_permissions = {
        'destroy': 'delete_records',
        'update': 'edit_invoice',
        'partial_update': 'edit_invoice',
        'generate_pdf': 'generate_invoice',
        'change_status': 'change_status_generic',
        'extend_due_date': 'extend_due_date',
    }

    def get_queryset(self):
        qs = Invoice.objects.select_related('winner').order_by('-createdAt')
        p = self.request.query_params

        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('batchId'):
            qs = qs.filter(importBatch_id=p['batchId'])
        if p.get('bidderName'):
            qs = qs.filter(winner__bidderName__icontains=p['bidderName'])
        if p.get('phoneNumber'):
            qs = qs.filter(winner__winnerPhone__icontains=p['phoneNumber'])
        if p.get('companyName'):
            qs = qs.filter(winner__companyName__icontains=p['companyName'])
        if p.get('lotNo'):
            qs = qs.filter(lots__lotNumber__icontains=p['lotNo']).distinct()
        if p.get('dateFrom'):
            qs = qs.filter(dueDate__gte=p['dateFrom'])
        if p.get('dateTo'):
            qs = qs.filter(dueDate__lte=p['dateTo'])
        return qs

    def get_serializer_class(self):
        return InvoiceListSerializer if self.action == 'list' else InvoiceDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = get_object_or_404(
            Invoice.objects.select_related('winner').prefetch_related('lots', 'payments', 'attachments'),
            pk=kwargs['pk'],
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        if not has_permission(request.user, 'view_dashboard'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        month_start = today.replace(day=1)

        status_keys = [
            'invoice_generated', 'pending_payment', 'payment_submitted',
            'under_verification', 'paid', 'overdue', 'cancelled', 'waived',
        ]
        counts = {k: 0 for k in status_keys}
        for row in Invoice.objects.values('status').annotate(n=Count('id')):
            counts[row['status']] = row['n']

        total_due = InvoiceLot.objects.aggregate(t=Sum('lotFee'))['t'] or 0
        verified_payments = Payment.objects.filter(paymentStatus='verified')
        total_collected = verified_payments.aggregate(t=Sum('amountPaid'))['t'] or 0
        outstanding = total_due - total_collected
        collection_pct = (total_collected / total_due * 100) if total_due else 0

        today_collected = verified_payments.filter(verifiedDate__date=today).aggregate(t=Sum('amountPaid'))['t'] or 0
        month_collected = verified_payments.filter(verifiedDate__date__gte=month_start).aggregate(t=Sum('amountPaid'))['t'] or 0

        return Response({
            'totalInvoices': Invoice.objects.count(),
            'totalAmountDue': str(total_due),
            'totalCollected': str(total_collected),
            'totalOutstanding': str(outstanding),
            'collectionPercentage': f"{collection_pct:.2f}",
            'invoiceGeneratedCount': counts['invoice_generated'],
            'pendingPaymentCount': counts['pending_payment'],
            'paymentSubmittedCount': counts['payment_submitted'],
            'underVerificationCount': counts['under_verification'],
            'paidCount': counts['paid'],
            'overdueCount': counts['overdue'],
            'cancelledCount': counts['cancelled'],
            'waivedCount': counts['waived'],
            'paymentsReceivedToday': str(today_collected),
            'paymentsReceivedThisMonth': str(month_collected),
        })

    @action(detail=True, methods=['post'], url_path='generate-pdf')
    def generate_pdf(self, request, pk=None):
        from weasyprint import HTML
        invoice = self.get_object()

        fee_percentage = request.data.get('feePercentage')
        auction_ref_number = request.data.get('auctionRefNumber', '')
        bidder_name_amharic = request.data.get('bidderNameAmharic', '').strip()
        amount_in_words = request.data.get('amountInWords', '').strip()
        fee_in_words = request.data.get('feeInWords', '').strip()
        office_address = request.data.get('officeAddress', '').strip()
        total_amount_override = request.data.get('totalAmount')
        fee_amount_override = request.data.get('feeAmount')
        bank_account_override = request.data.get('bankAccount', '').strip()
        paragraph1_override = request.data.get('paragraph1', '').strip()
        paragraph2_override = request.data.get('paragraph2', '').strip()

        if fee_percentage is not None:
            fee_percentage = Decimal(str(fee_percentage))
            for lot in invoice.lots.all():
                lot.feePercentage = fee_percentage
                lot.save()
        if bidder_name_amharic:
            invoice.winner.bidderNameAmharic = bidder_name_amharic
            invoice.winner.save(update_fields=['bidderNameAmharic'])

        if invoice.status == 'invoice_generated':
            previous = invoice.status
            invoice.status = 'pending_payment'
            invoice.save(update_fields=['status', 'updatedAt'])
            log_audit(invoice, 'Generate invoice PDF', request.user, previous, invoice.status, action_type='generate_invoice_pdf')
        else:
            log_audit(invoice, 'Generate invoice PDF', request.user, invoice.status, invoice.status, action_type='generate_invoice_pdf')

        images = {}
        static_dir = os.path.join(settings.BASE_DIR, 'invoices', 'static')
        for filename, key in [('logo.png', 'logo'), ('stamp.png', 'stamp'),
                            ('signature.png', 'signature'), ('footer.png', 'footer'), ('watermark.png', 'watermark')]:
            filepath = os.path.join(static_dir, filename)
            images[key] = ''
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    images[key] = base64.b64encode(f.read()).decode('utf-8')

        try:
            html_string = self._render_invoice_html(
                invoice, auction_ref_number, images,
                amount_in_words, fee_in_words, office_address,
                total_amount_override, fee_amount_override, bank_account_override,
                paragraph1_override, paragraph2_override,
            )
            pdf_bytes = HTML(string=html_string).write_pdf()
            return FileResponse(
                BytesIO(pdf_bytes),
                as_attachment=True,
                filename=f"Invoice_{invoice.invoiceNumber}.pdf",
                content_type='application/pdf'
            )
        except Exception as e:
            return Response({'detail': f'PDF generation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _render_invoice_html(self, invoice, auction_ref_number, images,amount_in_words='', fee_in_words='', office_address='',total_amount_override=None, fee_amount_override=None,bank_account_override='', paragraph1_override='', paragraph2_override=''):
        winner = invoice.winner
        display_name = winner.bidderNameAmharic or winner.bidderName
        lots = list(invoice.lots.all())

        total_amount = (
            Decimal(str(total_amount_override))
            if total_amount_override not in (None, '')
            else sum((lot.winningAmount for lot in lots), Decimal('0.00'))
        )
        total_fee = (
            Decimal(str(fee_amount_override))
            if fee_amount_override not in (None, '')
            else sum((lot.lotFee for lot in lots), Decimal('0.00'))
        )
        fee_percentage = lots[0].feePercentage.normalize() if lots else Decimal('0')
        auction_name = lots[0].auctionName if lots else ''
        lot_numbers = _join_amharic_list([lot.lotNumber for lot in lots])
        bank_account = bank_account_override or "1000547266289"

        if paragraph1_override:
            paragraph1 = paragraph1_override
        else:
            amount_words_part = f" ({amount_in_words})" if amount_in_words else ""
            fee_words_part = f" ({fee_in_words})" if fee_in_words else ""
            paragraph1 = (
                f"{auction_name} ለኩባንያው አገልግሎት የማያሰጡ የተለያዩ ዕቃዎችን በጨረታ አወዳድሮ ለመሸጥ ባወጣው የጨረታ ቁጥር {auction_ref_number} "
                f"ተሳትፈው በሎት ቁጥር {lot_numbers} የተጠቀሱትን ለመግዛት ባቀረቡት ጠቅላላ ዋጋ ቫትን ጨምሮ ብር {total_amount:,.2f}{amount_words_part} ሲሆን "
                f"የንብረቶቹን ርክክብ መመሪያ ተመልክተው ከተረከቡ በኋላ ከአሸነፉበት ዋጋ ላይ የሚታሰብ {fee_percentage}% (processing fee) {total_fee:,.2f}{fee_words_part} "
                f"ለአክሽን ኢትዮጵያ የሚከፍሉ ይሆናል፡፡"
            )

        if paragraph2_override:
            paragraph2 = paragraph2_override
        else:
            default_address = "ቦሌ አትላስ ከአውሮፓ ዩኒየን ዝቅ ብሎ ከለላ ህንጻ 3ኛ ፎቅ ቢሮ ቁጥር 301"
            address_text = office_address or default_address
            paragraph2 = f"ስለሆነም በኢትዮጵያ ንግድ ባንክ የሂሳብ ቁጥር {bank_account} ገቢ በማድረግ {address_text} በአካል በመገኘት ደረሰኝ እንዲያስገቡ እንጠይቃለን፡፡"

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{ size: A4; margin: 0; }}
                body {{ font-family: 'Noto Sans Ethiopic', sans-serif; font-size: 16.5px; color: #111; margin: 0; padding: 45px 55px 0 55px; }}
                .header {{ display: flex; justify-content: space-between; align-items: flex-start; }}
                .logo img {{ width: 240px; }}
                .ref-block {{ text-align: right; font-size: 14.5px; }}
                .ref-block div {{ margin-bottom: 6px; }}
                .ref-block .val {{ text-decoration: underline; }}
                hr.rule {{ border: none; border-top: 1px solid #999; margin: 12px 0 30px 0; }}
                .salutation {{ margin: 0 0 15px 0; font-size: 14.5px; }}
                .subject {{ text-align: center; font-weight: bold; text-decoration: underline; margin: 20px 0; font-size: 14.5px; }}
                .body-text {{ text-align: justify; line-height: 2.1; font-size: 14.5px; margin-bottom: 18px; }}
                .closing {{ text-align: right; margin-top: 50px; font-size: 14.5px; }}
                .stamp-sig-row {{ display: flex; justify-content: space-between; align-items: center; margin-top: 40px; }}
                .watermark {{ position: fixed; left: 25%; top: 50%; transform: translate(-50%, -25%); opacity: 0.3; z-index: -1; width: 900px; }}
                .stamp-img {{ width: 250px; margin-left: 50px; }}
                .sig-block {{ text-align: right; font-size: 10.5px; }}
                .sig-img {{ width: 60px; display: block; margin-left: auto; margin-bottom: 4px; }}
                .footer-band {{ position: fixed; bottom: 0; left: 0; width: 100%; }}
                .footer-band img {{ width: 100%; display: block; }}
            </style>
        </head>
        <body>
            <img class="watermark" src="data:image/png;base64,{images['watermark']}">
            <div class="header">
                <div class="logo"><img src="data:image/png;base64,{images['logo']}"></div>
                <div class="ref-block">
                    <div>ቀን: <span class="val">{invoice.invoiceDate.strftime('%d/%m/%Y')}</span></div>
                    <div>ቁጥር: <span class="val">{invoice.invoiceNumber}</span></div>
                </div>
            </div>
            <hr class="rule">
            <div class="salutation">
                <div>ለ {display_name}</div>
                <div>ባሉበት</div>
            </div>
            <div class="subject">ጉዳይ፡- የጨረታ processing fee እንዲከፍሉ ስለማሳወቅ</div>
            <div class="body-text">{paragraph1}</div>
            <div class="body-text">{paragraph2}</div>
            <div class="body-text">ማሳሰቢያ፡- ለጨረታ መወዳደሪያ ያስያዙት ሲ.ፒ.ኦ ተመላሽ የሚደረገው processing fee መከፈላችሁ ከተረጋገጠ በኋላ ነው፡፡</div>
            <div class="closing">ከሰላምታ ጋር</div>
            <div class="stamp-sig-row">
                <img class="stamp-img" src="data:image/png;base64,{images['stamp']}">
            </div>
            <div class="footer-band"><img src="data:image/png;base64,{images['footer']}"></div>
        </body>
        </html>
        """
    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        invoice = self.get_object()
        new_status = request.data.get('status')
        reason = request.data.get('reason', '')

        if not new_status:
            return Response({'status': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        if not can_transition(invoice.status, new_status, request.user):
            return Response({'error': 'Status transition not allowed'}, status=status.HTTP_400_BAD_REQUEST)

        previous = invoice.status
        invoice.status = new_status
        invoice.save(update_fields=['status', 'updatedAt'])
        log_audit(invoice, f'Status changed to {new_status}', request.user, previous, new_status, reason, action_type='change_status')
        latest_payment = invoice.payments.order_by('-uploadedAt').first()
        if latest_payment:
            if new_status in ('under_verification', 'paid') and latest_payment.paymentStatus == 'pending':
                latest_payment.paymentStatus = 'verified'
                latest_payment.verifiedBy = request.user
                latest_payment.verifiedDate = timezone.now()
                latest_payment.save()
            elif new_status == 'pending_payment' and previous == 'payment_submitted':
                latest_payment.paymentStatus = 'rejected'
                latest_payment.save()

        invoice.refresh_from_db()
        serializer = InvoiceDetailSerializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='extend-due-date')
    def extend_due_date(self, request, pk=None):
        invoice = self.get_object()
        new_due_date = request.data.get('dueDate')
        if not new_due_date:
            return Response({'dueDate': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        previous = str(invoice.dueDate)
        invoice.dueDate = new_due_date
        invoice.save(update_fields=['dueDate', 'updatedAt'])
        log_audit(invoice, 'Extend due date', request.user, previous, new_due_date, request.data.get('reason', ''), action_type='extend_due_date')
        serializer = InvoiceDetailSerializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None):
        invoice = self.get_object()

        if request.method == 'GET':
            serializer = PaymentSerializer(invoice.payments.all().order_by('-uploadedAt'), many=True)
            return Response(serializer.data)

        if not has_permission(request.user, 'upload_payment_proof'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PaymentSerializer(data={**request.data, 'invoice': invoice.id})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if invoice.status == 'pending_payment':
            previous = invoice.status
            invoice.status = 'payment_submitted'
            invoice.save(update_fields=['status', 'updatedAt'])
            log_audit(invoice, 'Extend due date', request.user, previous, new_due_date, request.data.get('reason', ''), action_type='extend_due_date')
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='attachments')
    def attachments_action(self, request, pk=None):
        invoice = self.get_object()

        if request.method == 'GET':
            serializer = AttachmentSerializer(invoice.attachments.all().order_by('-uploadDate'), many=True)
            return Response(serializer.data)

        if not has_permission(request.user, 'upload_payment_proof'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data['invoice'] = invoice.id
        serializer = AttachmentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(uploadedBy=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AttachmentDeleteView(generics.DestroyAPIView):
    """DELETE /api/attachments/{id}/ — deliberately delete-only, matches the contract."""
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        if not has_permission(self.request.user, 'delete_records'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Permission denied')
        instance.delete()


class AuditLogListView(generics.ListAPIView):
    """
    Read-only at every layer — the model has no delete/update path exposed
    anywhere, admin.py blocks all writes, and this view is List-only.
    Supports ?user_id=, ?role=, ?action=, ?date_from=, ?date_to=, ?ordering=
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    ALLOWED_ORDER_FIELDS = {'actionDate', 'userRole', 'action', 'performedBy__username'}

    def list(self, request, *args, **kwargs):
        if not has_permission(request.user, 'view_audit'):
            return Response({'error': "You don't have permission to view the audit trail."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = AuditLog.objects.select_related('invoice', 'performedBy').order_by('-actionDate')
        p = self.request.query_params

        if p.get('invoice_id'):
            qs = qs.filter(invoice_id=p['invoice_id'])
        if p.get('user_id'):
            qs = qs.filter(performedBy_id=p['user_id'])
        if p.get('role'):
            qs = qs.filter(userRole=p['role'])
        if p.get('action'):
            qs = qs.filter(actionType=p['action'])
        if p.get('date_from'):
            qs = qs.filter(actionDate__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(actionDate__date__lte=p['date_to'])

        ordering = p.get('ordering')
        if ordering and ordering.lstrip('-') in self.ALLOWED_ORDER_FIELDS:
            qs = qs.order_by(ordering)

        return qs

class AuditLogFilterOptionsView(APIView):
    """GET /api/audit-logs/filter-options/ — populates the User/Role/Action dropdowns."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_permission(request.user, 'view_audit'):
            return Response({'error': "You don't have permission to view the audit trail."}, status=status.HTTP_403_FORBIDDEN)

        user_rows = (
            AuditLog.objects.exclude(performedBy__isnull=True)
            .values_list('performedBy_id', 'performedBy__username')
            .distinct()
            .order_by('performedBy__username')
        )
        roles = (
            AuditLog.objects.exclude(userRole='')
            .values_list('userRole', flat=True)
            .distinct()
            .order_by('userRole')
        )

        return Response({
            'users': [{'id': uid, 'username': uname} for uid, uname in user_rows],
            'roles': list(roles),
            'actionTypes': [{'value': v, 'label': l} for v, l in AuditLog.ACTION_TYPE_CHOICES],
        })
    
class FeeConfigView(generics.GenericAPIView):
    """GET current active config, PUT to create a new active one (keeps history — see FeeConfig docstring)."""
    serializer_class = FeeConfigSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = FeeConfig.objects.filter(isActive=True).first()
        if not config:
            return Response({'percentage': '0.95', 'configuredBy': '', 'configuredAt': None})
        return Response(FeeConfigSerializer(config).data)

    def put(self, request):
        if not has_permission(request.user, 'manage_fee_config'):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        percentage = request.data.get('percentage')
        if percentage is None:
            return Response({'percentage': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        FeeConfig.objects.filter(isActive=True).update(isActive=False)
        config = FeeConfig.objects.create(percentage=percentage, configuredBy=request.user, isActive=True)
        return Response(FeeConfigSerializer(config).data)


# ================================================================= Auth View

class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: {username, password}
    Returns: {token, username, role}
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.create(serializer.validated_data)
            return Response(result, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    


class OfficeSettingsView(generics.GenericAPIView):
    """GET current saved office address, PUT to save a new one (admin only)."""
    serializer_class = OfficeSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = OfficeSettings.objects.filter(isActive=True).first()
        if not config:
            return Response({'address': '', 'configuredBy': '', 'configuredAt': None})
        return Response(OfficeSettingsSerializer(config).data)

    def put(self, request):
        if not has_permission(request.user, 'manage_fee_config'):  # reuse admin-only key
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        address = request.data.get('address', '')
        OfficeSettings.objects.filter(isActive=True).update(isActive=False)
        config = OfficeSettings.objects.create(address=address, configuredBy=request.user, isActive=True)
        return Response(OfficeSettingsSerializer(config).data)