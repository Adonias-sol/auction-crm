"""Single source of truth for the 11-item privilege grid — both the
Employees/Roles UI and has_permission() read from this."""

PRIVILEGE_CATALOG = [
    {'key': 'view_invoices', 'label': 'View invoices & winner records', 'category': 'Processing Fees'},
    {'key': 'edit_invoice', 'label': 'Edit invoice details / winner records', 'category': 'Processing Fees'},
    {'key': 'generate_invoice', 'label': 'Generate invoice PDF', 'category': 'Processing Fees'},
    {'key': 'change_status_generic', 'label': 'Change payment status', 'category': 'Processing Fees'},
    {'key': 'verify_payment', 'label': 'Verify / reject payments', 'category': 'Processing Fees'},
    {'key': 'import_batches', 'label': 'Import new bid data batches', 'category': 'Processing Fees'},
    {'key': 'view_reports', 'label': 'Generate custom reports', 'category': 'Reports'},
    {'key': 'view_audit', 'label': 'View audit trail', 'category': 'Reports'},
    {'key': 'manage_call_center', 'label': 'Manage CRM / call center inquiries', 'category': 'CRM'},
    {'key': 'view_call_center_dashboard', 'label': 'View call center payment dashboard', 'category': 'CRM'},
    {'key': 'manage_users', 'label': 'Manage employee accounts & privileges', 'category': 'Administration'},
]

PRIVILEGE_KEYS = {p['key'] for p in PRIVILEGE_CATALOG}

BUILT_IN_ROLE_DEFAULTS = {
    'Administrator': [p['key'] for p in PRIVILEGE_CATALOG],
    'Auction Manager': ['view_invoices', 'edit_invoice', 'generate_invoice', 'import_batches', 'view_reports', 'view_audit'],
    'Finance Manager': ['view_invoices', 'change_status_generic', 'verify_payment', 'view_reports', 'view_audit'],
    'CRM / Call Center Officer': ['manage_call_center', 'view_call_center_dashboard', 'view_reports'],
    'Viewer': ['view_invoices', 'view_audit'],
}