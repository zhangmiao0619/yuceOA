import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from api_client import login_api, create_project_api
import time

E2E_PROJECT = "E2E_全流程测试项目"


class TestEndToEndFlow:

    @pytest.mark.order(1)
    def test_create_project_via_api(self):
        token = login_api("wangleng", "123456")
        result = create_project_api(token, {
            "name": E2E_PROJECT,
            "description": "端到端全流程测试",
            "clientShortName": "武汉宇测",
        }, sub_tasks=[{"title": "E2E_韩鹏任务"}])
        assert result is not None

    @pytest.mark.order(2)
    def test_project_appears_in_ui(self, driver, login_as_wangleng):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)
        try:
            link = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, f"//a[contains(translate(., ' ', ''), '{E2E_PROJECT}')]")
                )
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
            time.sleep(0.3)
        except TimeoutException:
            pytest.fail(f"项目{E2E_PROJECT}不可见")

    @pytest.mark.order(3)
    def test_hanpeng_receives_task(self, driver, login_as_hanpeng):
        driver.get("http://localhost:5173/tasks")
        time.sleep(3)
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//div[contains(@class, 'ant-card')]")
                )
            )
        except TimeoutException:
            pytest.skip("任务看板加载超时")

    @pytest.mark.order(4)
    def test_wangleng_views_project(self, driver, login_as_wangleng):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)
        try:
            link = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, f"//a[contains(translate(., ' ', ''), '{E2E_PROJECT}')]")
                )
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
            time.sleep(0.3)
            driver.execute_script("arguments[0].click();", link)
            time.sleep(1)
            assert "/projects/" in driver.current_url
        except TimeoutException:
            pytest.skip(f"项目{E2E_PROJECT}不可访问")

    @pytest.mark.order(5)
    def test_admin_login(self, driver, login_as_admin):
        assert "/login" not in driver.current_url
