from decimal import Decimal
from io import BytesIO

from django.core.files.base import ContentFile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status

from .models import GeneratedReport
from .report_queries import run_report

REPORT_TITLES = {
    'outstanding': 'Outstanding processing fees', 'daily': 'Daily collections',
    'monthly': 'Monthly collections', 'verification': 'Payment verification report',
    'overdue': 'Overdue payments report', 'by-auction': 'Revenue by auction',
    'by-client': 'Revenue by client',
}


def _parse_filters(data):
    """Filters arrive as querystring-ish flat data from either GET params
    or a POST body — paymentStatus can be a repeated field (list) or a
    single value, normalize either way."""
    payment_status = data.getlist('paymentStatus') if hasattr(data, 'getlist') else data.get('paymentStatus')
    if payment_status and not isinstance(payment_status, list):
        payment_status = [payment_status]
    return {
        'period': data.get('period', 'month'),
        'clientCompany': data.get('clientCompany') or None,
        'importBatch': data.get('importBatch') or None,
        'dateFrom': data.get('dateFrom') or None,
        'dateTo': data.get('dateTo') or None,
        'auction': data.get('auction') or None,
        'paymentStatus': payment_status or None,
    }


class ReportPreviewView(APIView):
    """POST /api/reports/preview/ — runs the query, returns JSON only. Saves nothing."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        report_type = request.data.get('reportType')
        if report_type not in REPORT_TITLES:
            return Response({'error': f'Unknown reportType: {report_type}'}, status=http_status.HTTP_400_BAD_REQUEST)

        filters = _parse_filters(request.data)
        try:
            title, period_label, columns, rows, total = run_report(report_type, filters)
        except Exception as e:
            return Response({'error': str(e)}, status=http_status.HTTP_400_BAD_REQUEST)

        return Response({
            'reportType': report_type, 'title': title, 'periodLabel': period_label,
            'columns': columns, 'rows': rows, 'count': len(rows), 'total': str(total),
        })


import logging
logger = logging.getLogger(__name__)

class ReportGeneratePdfView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        report_type = request.data.get('reportType')
        if report_type not in REPORT_TITLES:
            return Response({'error': f'Unknown reportType: {report_type}'}, status=http_status.HTTP_400_BAD_REQUEST)

        filters = _parse_filters(request.data)
        try:
            title, period_label, columns, rows, total = run_report(report_type, filters)
        except Exception as e:
            logger.exception("run_report failed")
            return Response({'error': str(e)}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            from weasyprint import HTML
            html_string = self._render_report_html(title, period_label, columns, rows, total)
            pdf_bytes = HTML(string=html_string).write_pdf()

            from django.utils import timezone
            report = GeneratedReport(
                reportType=report_type, title=title, periodLabel=period_label,
                filters=filters, rowCount=len(rows), totalAmount=total,
                generatedBy=request.user if request.user.is_authenticated else None,
            )
            fname = f"{report_type}-{timezone.now():%Y%m%d%H%M%S}.pdf"
            report.file.save(fname, ContentFile(pdf_bytes), save=False)
            report.save()

            from django.http import FileResponse
            return FileResponse(BytesIO(pdf_bytes), as_attachment=True,
                                 filename=f"{title.replace(' ', '_')}.pdf", content_type='application/pdf')
        except Exception as e:
            logger.exception("PDF generation/save failed")
            return Response({'error': f'PDF generation failed: {e}'}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    @staticmethod
    def _render_report_html(title, period_label, columns, rows, total):
        head = ''.join(f"<th>{c['label']}</th>" for c in columns)
        body = ''.join(
            '<tr>' + ''.join(f"<td>{r.get(c['key'], '')}</td>" for c in columns) + '</tr>'
            for r in rows
        )
        return f"""
        <!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            @page {{ size: A4; margin: 30px; }}
            body {{ font-family: sans-serif; font-size: 12px; }}
            h1 {{ font-size: 18px; margin-bottom: 2px; }}
            .meta {{ color: #666; margin-bottom: 16px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }}
            th {{ background: #f3f3f3; }}
            .total {{ margin-top: 12px; font-weight: bold; text-align: right; }}
        </style></head><body>
            <h1>{title}</h1>
            <div class="meta">{period_label} &middot; {len(rows)} record(s)</div>
            <table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>
            <div class="total">Total: ETB {total:,.2f}</div>
        </body></html>
        """


class RecentReportsView(APIView):
    """GET /api/reports/recent/ — backs the 'Recently generated' list."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reports = GeneratedReport.objects.order_by('-generatedAt')[:20]
        return Response([{
            'id': r.id, 'reportType': r.reportType, 'title': r.title, 'periodLabel': r.periodLabel,
            'rowCount': r.rowCount, 'totalAmount': str(r.totalAmount) if r.totalAmount is not None else None,
            'generatedAt': r.generatedAt.isoformat(),
            'generatedBy': (r.generatedBy.get_full_name() or r.generatedBy.get_username()) if r.generatedBy else '—',
            'fileUrl': r.file.url if r.file else None,
        } for r in reports])