from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status

from .models import StaffProfile, Role
from .serializers import EmployeeSerializer, RoleSerializer
from .permissions import has_permission
from .privileges import PRIVILEGE_CATALOG, PRIVILEGE_KEYS


class PrivilegeCatalogView(APIView):
    """GET /api/privileges/ — the 11-item grid definition, so frontend never hardcodes it."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PRIVILEGE_CATALOG)


class RoleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.all().order_by('name')
        return Response(RoleSerializer(roles, many=True).data)

    def post(self, request):
        if not has_permission(request.user, 'manage_users'):
            return Response({'error': 'Only administrators can create roles.'}, status=http_status.HTTP_403_FORBIDDEN)

        name = request.data.get('name', '').strip()
        privileges = request.data.get('defaultPrivileges', [])
        if not name:
            return Response({'error': 'Role name is required.'}, status=http_status.HTTP_400_BAD_REQUEST)
        if Role.objects.filter(name__iexact=name).exists():
            return Response({'error': 'A role with that name already exists.'}, status=http_status.HTTP_400_BAD_REQUEST)
        invalid = set(privileges) - PRIVILEGE_KEYS
        if invalid:
            return Response({'error': f'Unknown privilege keys: {invalid}'}, status=http_status.HTTP_400_BAD_REQUEST)

        role = Role.objects.create(name=name, defaultPrivileges=privileges, isBuiltIn=False)
        return Response(RoleSerializer(role).data, status=http_status.HTTP_201_CREATED)


class EmployeeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profiles = StaffProfile.objects.select_related('user', 'role').order_by('user__username')
        return Response(EmployeeSerializer(profiles, many=True).data)

    def post(self, request):
        if not has_permission(request.user, 'manage_users'):
            return Response({'error': 'Only administrators can create employees.'}, status=http_status.HTTP_403_FORBIDDEN)

        full_name = request.data.get('fullName', '').strip()
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        role_id = request.data.get('roleId')
        privileges = request.data.get('privileges')

        if not (full_name and username and password and role_id):
            return Response({'error': 'Full name, username, password, and role are required.'}, status=http_status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'That username is already taken.'}, status=http_status.HTTP_400_BAD_REQUEST)
        try:
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return Response({'error': 'Invalid role.'}, status=http_status.HTTP_400_BAD_REQUEST)

        first, *rest = full_name.split(' ', 1)
        user = User.objects.create_user(username=username, password=password, first_name=first, last_name=rest[0] if rest else '')

        final_privileges = privileges if privileges is not None else role.defaultPrivileges
        invalid = set(final_privileges) - PRIVILEGE_KEYS
        if invalid:
            user.delete()
            return Response({'error': f'Unknown privilege keys: {invalid}'}, status=http_status.HTTP_400_BAD_REQUEST)

        profile = StaffProfile.objects.create(
            user=user, role=role, privileges=final_privileges,
            isActive=True, lastPasswordChange=timezone.now(),
        )
        return Response(EmployeeSerializer(profile).data, status=http_status.HTTP_201_CREATED)


class EmployeePrivilegesView(APIView):
    """PATCH /api/employees/<id>/privileges/ — update one user's effective privileges directly."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, employee_id):
        if not has_permission(request.user, 'manage_users'):
            return Response({'error': 'Only administrators can edit privileges.'}, status=http_status.HTTP_403_FORBIDDEN)

        try:
            profile = StaffProfile.objects.get(id=employee_id)
        except StaffProfile.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        privileges = request.data.get('privileges', [])
        invalid = set(privileges) - PRIVILEGE_KEYS
        if invalid:
            return Response({'error': f'Unknown privilege keys: {invalid}'}, status=http_status.HTTP_400_BAD_REQUEST)

        profile.privileges = privileges
        profile.save(update_fields=['privileges'])
        return Response(EmployeeSerializer(profile).data)


class EmployeeDeactivateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, employee_id):
        if not has_permission(request.user, 'manage_users'):
            return Response({'error': 'Only administrators can deactivate employees.'}, status=http_status.HTTP_403_FORBIDDEN)
        try:
            profile = StaffProfile.objects.get(id=employee_id)
        except StaffProfile.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        profile.isActive = not profile.isActive
        profile.save(update_fields=['isActive'])
        profile.user.is_active = profile.isActive
        profile.user.save(update_fields=['is_active'])
        return Response(EmployeeSerializer(profile).data)