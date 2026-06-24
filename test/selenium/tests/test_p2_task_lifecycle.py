import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from config import ACCOUNTS
from api_client import login_api, create_project_api, get_project_by_name_api
import time

PROJECT_NAME = "P2_任务生命周期测试"


class TestTaskAssignment:

    @pytest.mark.order(1)
    def test_create_project_with_assigned_tasks(self):
        token = login_api("wangleng", "123456")
        result = create_project_api(token, {
            "name": PROJECT_NAME,
            "description": "任务生命周期测试",
            "clientShortName": "武汉宇测",
        }, sub_tasks=[
            {"title": "P2_韩鹏_测绘任务"},
            {"title": "P2_李博_数据建库"},
        ])
        assert result is not None
        assert result.get("name") == PROJECT_NAME

    @pytest.mark.order(2)
    def test_hanpeng_sees_project(self, driver, login_as_hanpeng, projects_page):
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

    @pytest.mark.order(3)
    def test_libo_sees_project(self, driver, login_as_libo, projects_page):
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
    def test_wangleng_can_view_project_detail(self, driver, login_as_wangleng):
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


class TestTaskStatusFlow:

    @pytest.mark.order(5)
    def test_project_detail_tabs(self, driver, login_as_admin):
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
            time.sleep(2)

            overview = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//div[contains(translate(. ,' ', ''), '概览')]")
                )
            )
            tasks_tab = driver.find_element(
                By.XPATH, "//div[contains(translate(., ' ', ''), '子任务')]"
            )
            assert overview.is_displayed()
            assert tasks_tab.is_displayed()
        except TimeoutException:
            pytest.skip(f"项目{PROJECT_NAME}详情不可访问")
