from django.contrib import admin

from board.models import Invitation

@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['id', 'sender', 'receiver', 'created_date']
    list_per_page = 30
