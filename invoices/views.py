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
from weasyprint import HTML
import base64
import os
from django.conf import settings

from .models import (
    Auction, Winner, Invoice, InvoiceLot, Payment, Attachment, FeeConfig, AuditLog,
)
from .serializers import (
    AuctionSerializer, WinnerSerializer, InvoiceListSerializer,
    InvoiceDetailSerializer, PaymentSerializer, AttachmentSerializer,
    AuditLogSerializer, FeeConfigSerializer, LoginSerializer,
)
from .permissions import ReadOnlyForViewer, ActionPermissionMap, can_transition, has_permission


def log_audit(invoice, action_label, user, previous_value='', new_value='', reason=''):
    """
    One place that writes AuditLog rows, so every view stays consistent
    with what admin.py already enforces (read-only, code-created only).
    """
    AuditLog.objects.create(
        invoice=invoice,
        action=action_label,
        performedBy=user if user and user.is_authenticated else None,
        userRole=getattr(getattr(user, 'profile', None), 'role', ''),
        previousValue=str(previous_value),
        newValue=str(new_value),
        reason=reason,
    )


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
        """
        POST /api/invoices/{id}/generate-pdf/
        """
        invoice = self.get_object()
        
        if request.user.profile.role not in ['finance_manager', 'auction_manager', 'administrator']:
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        
        fee_percentage = request.data.get('feePercentage')
        auction_ref_number = request.data.get('auctionRefNumber', '')

        if fee_percentage is not None:
            fee_percentage = Decimal(str(fee_percentage))
            for lot in invoice.lots.all():
                lot.feePercentage = fee_percentage
                lot.save()

        if invoice.status == 'invoice_generated':
            previous = invoice.status
            invoice.status = 'pending_payment'
            invoice.save(update_fields=['status', 'updatedAt'])
            log_audit(invoice, 'Generate invoice PDF', request.user, previous, invoice.status)

        # Read images as base64
        import base64
        import os
        from django.conf import settings
        
        logo_base64 = ''
        stamp_base64 = ''
        signature_base64 = ''
        watermark_base64 = ''
        
        static_dir = os.path.join(settings.BASE_DIR, 'invoices', 'static')
        
        for filename, var_name in [('logo.png', 'logo_base64'), ('stamp.png', 'stamp_base64'), ('signature.png', 'signature_base64'), ('watermark.png', 'watermark_base64')]:
            filepath = os.path.join(static_dir, filename)
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'rb') as f:
                        encoded = base64.b64encode(f.read()).decode('utf-8')
                        if var_name == 'logo_base64':
                            logo_base64 = encoded
                        elif var_name == 'stamp_base64':
                            stamp_base64 = encoded
                        elif var_name == 'signature_base64':
                            signature_base64 = encoded
                        elif var_name == 'watermark_base64':
                            watermark_base64 = encoded
                except Exception as e:
                    pass

        html_string = self._render_invoice_html(invoice, auction_ref_number, logo_base64, stamp_base64, signature_base64, watermark_base64)

        try:
            pdf_bytes = HTML(string=html_string).write_pdf()
            return FileResponse(
                BytesIO(pdf_bytes),
                as_attachment=True,
                filename=f"Invoice_{invoice.invoiceNumber}.pdf",
                content_type='application/pdf'
            )
        except Exception as e:
            return Response({'detail': f'PDF generation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        def _render_invoice_html(self, invoice, auction_ref_number='', logo_base64='', stamp_base64='', signature_base64='', watermark_base64=''):
            """
            Render invoice as HTML matching Auction Ethiopia official Amharic letter format.
            """
            winner = invoice.winner
            lots_html = ""
            total_fee = Decimal('0.00')

            for lot in invoice.lots.all():
                total_fee += lot.lotFee
                lots_html += f"""
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">{lot.lotNumber}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{lot.auctionName}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">ETB {lot.winningAmount:,.2f}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">ETB {lot.lotFee:,.2f}</td>
                </tr>
                """

            # Build image HTML outside main template
            watermark_html = f'<img src="data:image/png;base64,{watermark_base64}" class="watermark" />' if watermark_base64 else ''
            logo_html = f'<img src="data:image/png;base64,{logo_base64}" style="max-width: 120px; margin-bottom: 10px;" />' if logo_base64 else ''
            stamp_html = f'<img src="data:image/png;base64,{stamp_base64}" style="max-width: 150px;" />' if stamp_base64 else '<div style="font-size: 24px; color: #999;">[OFFICIAL STAMP]</div>'
            signature_html = f'<img src="data:image/png;base64,{signature_base64}" style="max-width: 150px; margin-bottom: 10px;" />' if signature_base64 else '<div style="font-size: 24px; color: #999;">[SIGNATURE]</div>'

            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        margin: 40px;
                        color: #333;
                        line-height: 1.5;
                    }}
                    .watermark {{
                        position: fixed;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        opacity: 0.1;
                        z-index: -1;
                        width: 400px;
                        height: 400px;
                    }}
                    .header {{
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 40px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                    }}
                    .company-info {{
                        text-align: center;
                        flex: 1;
                    }}
                    .company-name {{
                        font-size: 20px;
                        font-weight: bold;
                    }}
                    .company-subtitle {{
                        font-size: 12px;
                        color: #666;
                    }}
                    .audit-ref {{
                        text-align: right;
                    }}
                    .audit-ref-label {{
                        font-size: 11px;
                        color: #666;
                    }}
                    .audit-ref-value {{
                        font-size: 12px;
                        font-weight: bold;
                    }}
                    .letter-opener {{
                        margin: 30px 0;
                    }}
                    .letter-opener p {{
                        margin: 8px 0;
                        font-size: 13px;
                    }}
                    .recipient {{
                        margin: 20px 0;
                        font-size: 13px;
                    }}
                    .recipient-label {{
                        font-weight: bold;
                        display: inline-block;
                        width: 30px;
                    }}
                    .recipient-name {{
                        display: inline-block;
                    }}
                    .intro-text {{
                        margin: 20px 0;
                        font-size: 13px;
                        line-height: 1.6;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin: 30px 0;
                        font-size: 12px;
                    }}
                    th {{
                        background-color: #f5f5f5;
                        border: 1px solid #ddd;
                        padding: 10px;
                        text-align: left;
                        font-weight: bold;
                    }}
                    td {{
                        padding: 8px;
                        border: 1px solid #ddd;
                    }}
                    .total-row {{
                        background-color: #f9f9f9;
                        font-weight: bold;
                    }}
                    .total-row td {{
                        padding: 12px 8px;
                    }}
                    .footer-text {{
                        margin-top: 30px;
                        font-size: 12px;
                        line-height: 1.6;
                    }}
                    .signature-section {{
                        margin-top: 50px;
                        text-align: right;
                        font-size: 12px;
                    }}
                    .signature-line {{
                        margin-top: 40px;
                        border-top: 1px solid #333;
                        width: 150px;
                        margin-left: auto;
                    }}
                    .job-title {{
                        font-weight: bold;
                        margin-top: 5px;
                    }}
                    .job-title-en {{
                        font-size: 11px;
                        color: #666;
                    }}
                </style>
            </head>
            <body>
                {watermark_html}

                <div class="header">
                    <div class="company-info">
                        {logo_html}
                        <div class="company-name">Auction Ethiopia S.C.</div>
                        <div class="company-subtitle">PROCESSING FEE MANAGEMENT</div>
                    </div>
                    <div class="audit-ref">
                        <div class="audit-ref-label">ጨረታ ቁጥር:</div>
                        <div class="audit-ref-value">{auction_ref_number}</div>
                    </div>
                </div>

                <div class="letter-opener">
                    <p>ለደንበኞች ሂደ.</p>
                    <p>ጠብ ጥሪት</p>
                </div>

                <div class="intro-text">
                    ጭቃቂ- ደረሰኝ processing fee ኪሳራ ለጠ ተወደደዉ
                </div>

                <div class="recipient">
                    <span class="recipient-label">ለ:</span>
                    <span class="recipient-name">{winner.bidderName}</span>
                </div>

                <div class="intro-text">
                    Processing fee invoice for auction lots won. Please find the details below:
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Lot Number</th>
                            <th>Auction</th>
                            <th style="text-align: right;">Winning Amount</th>
                            <th style="text-align: right;">Processing Fee</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lots_html}
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right;">ጠቅላላ ዋጋ ቫትን ጨምሮ ብር:</td>
                            <td style="text-align: right;">ETB {total_fee:,.2f}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer-text">
                    <p><strong>Payment Terms:</strong> Payment must be submitted within 3 working days of invoice date.</p>
                    <p><strong>Invoice Date:</strong> {invoice.invoiceDate.strftime('%B %d, %Y')}</p>
                    <p><strong>Due Date:</strong> {invoice.dueDate.strftime('%B %d, %Y')}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    {stamp_html}
                </div>

                <div class="signature-section">
                    {signature_html}
                    <div class="signature-line"></div>
                    <div class="job-title">የደንበኞች አስተዳደር</div>
                    <div class="job-title-en">(Customer Service)</div>
                </div>
            </body>
            </html>
            """

            return html

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
        log_audit(invoice, f'Status changed to {new_status}', request.user, previous, new_status, reason)

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
        log_audit(invoice, 'Extend due date', request.user, previous, new_due_date, request.data.get('reason', ''))

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
            log_audit(invoice, 'Payment uploaded', request.user, previous, invoice.status)

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
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        if not has_permission(self.request.user, 'view_audit'):
            return AuditLog.objects.none()
        qs = AuditLog.objects.select_related('invoice', 'performedBy').order_by('-actionDate')
        invoice_id = self.request.query_params.get('invoice_id')
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        return qs


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