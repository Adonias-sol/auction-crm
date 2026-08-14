from django.urls import path
from .employee_views import (
    PrivilegeCatalogView, RoleListCreateView,
    EmployeeListCreateView, EmployeePrivilegesView, EmployeeDeactivateView,
)

urlpatterns = [
    path('privileges/', PrivilegeCatalogView.as_view(), name='privilege-catalog'),
    path('roles/', RoleListCreateView.as_view(), name='role-list-create'),
    path('employees/', EmployeeListCreateView.as_view(), name='employee-list-create'),
    path('employees/<int:employee_id>/privileges/', EmployeePrivilegesView.as_view(), name='employee-privileges'),
    path('employees/<int:employee_id>/deactivate/', EmployeeDeactivateView.as_view(), name='employee-deactivate'),
]