from django.urls import path
from .report_views import ReportPreviewView, ReportGeneratePdfView, RecentReportsView

urlpatterns = [
    path('reports/preview/', ReportPreviewView.as_view(), name='report-preview'),
    path('reports/generate-pdf/', ReportGeneratePdfView.as_view(), name='report-generate-pdf'),
    path('reports/recent/', RecentReportsView.as_view(), name='report-recent'),
]