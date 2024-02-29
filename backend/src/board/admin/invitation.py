from django.contrib import admin

from board.models import Invitation, InvitationRequest

@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['id', 'sender', 'receiver', 'created_date']
    list_per_page = 30

@admin.register(InvitationRequest)
class InvitationRequestAdmin(admin.ModelAdmin):
    list_display = ['id','sender','receiver', 'created_date']
    list_per_page = 30