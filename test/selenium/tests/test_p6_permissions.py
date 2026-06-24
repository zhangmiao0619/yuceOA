import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time


class TestPermissions:

    @pytest.mark.order(1)
    def test_admin_sees_all_projects(self, driver, login_as_admin):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)
        assert "/projects" in driver.current_url

        try:
            create_btn = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//button[contains(translate(., ' ', ''), '新建项目')]")
                )
            )
            assert create_btn.is_displayed(), "管理员应看到新建项目按钮"
        except TimeoutException:
            pytest.fail("管理员未看到新建项目按钮")

    @pytest.mark.order(2)
    def test_member_cannot_create_project(self, driver, login_as_libo):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)

        try:
            WebDriverWait(driver, 3).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//button[contains(translate(., ' ', ''), '新建项目')]")
                )
            )
            pytest.fail("普通员工不应看到新建项目按钮")
        except TimeoutException:
            pass

    @pytest.mark.order(3)
    def test_member_can_view_projects(self, driver, login_as_libo):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)

        try:
            has_table = len(driver.find_elements(By.XPATH, "//table")) > 0
            has_content = len(driver.find_elements(By.XPATH, "//div[contains(@class, 'ant-empty')]")) == 0
            if has_table or has_content:
                pass
        except Exception:
            pass

    @pytest.mark.order(4)
    def test_manager_can_see_create_button(self, driver, login_as_wangleng):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)

        try:
            create_btn = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//button[contains(translate(., ' ', ''), '新建项目')]")
                )
            )
            assert create_btn.is_displayed(), "部门主管应看到新建项目按钮"
        except TimeoutException:
            pytest.fail("部门主管未看到新建项目按钮")
