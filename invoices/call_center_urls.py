from django.urls import path
from .call_center_views import CallCenterListView, CallCenterNoteView

urlpatterns = [
    path('call-center/', CallCenterListView.as_view(), name='call-center-list'),
    path('call-center/<int:invoice_id>/note/', CallCenterNoteView.as_view(), name='call-center-note'),
]