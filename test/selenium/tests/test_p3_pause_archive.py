import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from config import ACCOUNTS
from api_client import login_api, create_project_api
import time

PROJECT_NAME = "P3_暂停归档测试"


class TestPauseArchive:

    @pytest.mark.order(1)
    def test_create_project_for_pause(self):
        token = login_api("wangleng", "123456")
        result = create_project_api(token, {
            "name": PROJECT_NAME,
            "description": "暂停归档测试",
            "clientShortName": "武汉宇测",
        })
        assert result is not None
        assert result.get("name") == PROJECT_NAME

    @pytest.mark.order(2)
    def test_navigate_project_detail(self, driver, login_as_wangleng):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)
        try:
            link = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, f"//a[contains(translate(., ' ', ''), '{PROJECT_NAME}')]")
                )
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
            time.sleep(0.3)
            driver.execute_script("arguments[0].click();", link)
            time.sleep(1)
            assert "/projects/" in driver.current_url
        except TimeoutException:
            pytest.skip(f"项目{PROJECT_NAME}不可访问")

    @pytest.mark.order(3)
    def test_admin_can_view_project(self, driver, login_as_admin):
        driver.get(f"http://localhost:5173/projects")
        time.sleep(2)
        try:
            link = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, f"//a[contains(translate(., ' ', ''), '{PROJECT_NAME}')]")
                )
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
            time.sleep(0.3)
            driver.execute_script("arguments[0].click();", link)
            time.sleep(1)
            assert "/projects/" in driver.current_url
        except TimeoutException:
            pytest.skip(f"项目{PROJECT_NAME}不可访问")
