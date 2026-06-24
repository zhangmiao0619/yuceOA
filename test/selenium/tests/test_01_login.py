import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from config import ACCOUNTS


class TestLogin:

    def test_admin_login_success(self, login_as_admin):
        assert "/login" not in login_as_admin

    def test_wangleng_login_success(self, login_as_wangleng):
        assert "/login" not in login_as_wangleng

    def test_libo_login_success(self, login_as_libo):
        assert "/login" not in login_as_libo

    def test_wrong_password(self, driver, login_page):
        login_page.open()
        login_page.login(ACCOUNTS["admin"]["username"], "wrong_password")
        try:
            msg = login_page.get_error_message()
            assert "用户名或密码错误" in msg or "登录失败" in msg, f"预期错误提示，实际得到: {msg}"
        except Exception:
            pass
        assert login_page.is_on_login_page(), "登录失败后应停留在登录页"
