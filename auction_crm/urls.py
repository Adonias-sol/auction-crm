from django.urls import path, include
from rest_framework.routers import DefaultRouter

from invoices.views import (
    AuctionViewSet, WinnerViewSet, InvoiceViewSet,
    AttachmentDeleteView, AuditLogListView, FeeConfigView,
)
from invoices.import_views import (
    ImportBatchViewSet, ImportBatchPreviewView, ImportBatchConfirmView,
)

router = DefaultRouter()
router.register(r'auctions', AuctionViewSet, basename='auction')
router.register(r'winners', WinnerViewSet, basename='winner')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'import-batches', ImportBatchViewSet, basename='import-batch')

urlpatterns = [
    # These two MUST come before the router include below. DRF's router
    # generates /import-batches/<pk>/ with a lookup regex that happily
    # matches ANY non-slash string — including the literal word "preview"
    # or "confirm" — and Django resolves urlpatterns top-to-bottom, first
    # match wins. Without this ordering, a request to /import-batches/preview/
    # would get routed into ImportBatchViewSet.retrieve() trying to find an
    # ImportBatch with pk="preview", and 404 instead of reaching this view.
    path('import-batches/preview/', ImportBatchPreviewView.as_view(), name='import-batch-preview'),
    path('import-batches/confirm/', ImportBatchConfirmView.as_view(), name='import-batch-confirm'),

    path('attachments/<int:pk>/', AttachmentDeleteView.as_view(), name='attachment-delete'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit-log-list'),
    path('fee-config/', FeeConfigView.as_view(), name='fee-config'),

    path('', include(router.urls)),
]