from django.contrib import auth
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render

from board.forms_initial_setup import InitialAdminSetupForm
from board.services.initial_setup_service import (
    InitialSetupBlockedError,
    InitialSetupService,
)


def initial_setup_view(request: HttpRequest) -> HttpResponse:
    if InitialSetupService.has_admin_account():
        raise Http404

    setup_token = (
        request.POST.get('setup_token', '')
        if request.method == 'POST'
        else request.GET.get('token', '')
    )

    if request.method == 'POST':
        form = InitialAdminSetupForm(request.POST, setup_token=setup_token)
        if form.is_valid():
            try:
                user = InitialSetupService.create_initial_admin(
                    username=form.cleaned_data['username'],
                    display_name=form.cleaned_data['display_name'],
                    email=form.cleaned_data['email'],
                    password=form.cleaned_data['password'],
                )
            except InitialSetupBlockedError:
                raise Http404

            auth.login(request, user)
            return redirect('/admin-settings/site-settings')
    elif request.method == 'GET':
        form = InitialAdminSetupForm(setup_token=setup_token)
    else:
        raise Http404

    form.apply_error_attrs()

    return render(request, 'board/setup/initial_admin.html', {
        'form': form,
        'hide_auth_links': True,
    })
