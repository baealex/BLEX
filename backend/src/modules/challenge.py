from board.services.hcaptcha_service import HCaptchaService


def auth_hcaptcha(response):
    return HCaptchaService.verify_response(response)
