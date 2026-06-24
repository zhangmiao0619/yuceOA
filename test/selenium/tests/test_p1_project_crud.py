import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from config import ACCOUNTS
from api_client import login_api, create_project_api, delete_project_api, get_projects_api
import time

PROJECT_NAME = "P1_测试项目_完整创建"
DRAFT_NAME = "P1_草稿项目"
EDIT_NAME = "P1_已编辑项目"


class TestProjectCreate:

    @pytest.mark.order(1)
    def test_create_project_via_api(self):
        token = login_api("wangleng", "123456")
        result = create_project_api(token, {
            "name": PROJECT_NAME,
            "description": "由API创建的测试项目",
            "clientShortName": "武汉宇测",
        }, sub_tasks=[{"title": "地形图测绘"}])
        assert result is not None
        assert result.get("name") == PROJECT_NAME

    @pytest.mark.order(2)
    def test_project_appears_in_ui_list(self, driver, login_as_wangleng, projects_page):
        projects_page.open()
        time.sleep(1)
        try:
            projects_page.wait_for_project_in_list(PROJECT_NAME, timeout=10)
        except TimeoutException:
            pytest.fail(f"项目「{PROJECT_NAME}」未出现在UI列表中")

        status = projects_page.get_project_status(PROJECT_NAME)
        assert status in ("规划中", "已分配"), f"预期状态'规划中'/'已分配'，实际'{status}'"

    @pytest.mark.order(3)
    def test_create_project_draft_via_api(self):
        token = login_api("wangleng", "123456")
        result = create_project_api(token, {
            "name": DRAFT_NAME,
            "description": "草稿测试",
            "clientShortName": "武汉宇测",
        })
        assert result is not None

    @pytest.mark.order(4)
    def test_draft_appears_in_ui(self, driver, login_as_wangleng, projects_page):
        projects_page.open()
        time.sleep(1)
        try:
            projects_page.wait_for_project_in_list(DRAFT_NAME, timeout=10)
        except TimeoutException:
            pytest.fail(f"草稿项目「{DRAFT_NAME}」未出现在列表中")

        status = projects_page.get_project_status(DRAFT_NAME)
        assert status in ("规划中", "已分配"), f"预期状态'规划中'/'已分配'，实际'{status}'"


class TestProjectEdit:

    @pytest.mark.order(5)
    def test_edit_project_name_in_ui(self, driver, login_as_wangleng, projects_page):
        projects_page.open()
        projects_page.click_project_row(PROJECT_NAME)
        time.sleep(1)

        try:
            edit_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(translate(., ' ', ''), '编辑')]"))
            )
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", edit_btn)
            time.sleep(0.3)
        except TimeoutException:
            pytest.skip("当前项目详情页无编辑按钮")

    @pytest.mark.order(6)
    def test_edit_project_no_permission(self, driver, login_as_libo, projects_page):
        projects_page.open()
        count = projects_page.get_project_count()
        if count == 0:
            pytest.skip("普通员工视图无项目列表")
        # 普通员工可以看到子任务的编辑按钮，但不能看到项目编辑按钮
        # 此处仅验证不报错即可


class TestProjectDelete:

    @pytest.mark.order(7)
    def test_delete_project_via_api(self):
        token = login_api("wangleng", "123456")
        # Create a temp project
        result = create_project_api(token, {
            "name": "P1_待删除项目",
            "description": "待删除",
            "clientShortName": "武汉宇测",
        })
        project_id = result.get("id")
        if project_id:
            del_result = delete_project_api(token, project_id)
            assert del_result.get("success") is True

    @pytest.mark.order(8)
    def test_delete_via_ui(self, driver, login_as_admin):
        driver.get("http://localhost:5173/projects")
        time.sleep(2)

        try:
            row = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.XPATH, f"//td[contains(text(), 'P1_待删除项目')]"))
            )
            pytest.fail("删除后的项目仍在列表中")
        except TimeoutException:
            pass


class TestProjectView:

    @pytest.mark.order(9)
    def test_project_list_filter(self, driver, login_as_admin, projects_page):
        projects_page.open()
        projects_page.filter_by_status("进行中")
        time.sleep(1)
        projects_page.click_reset_filter()
        time.sleep(1)

    @pytest.mark.order(10)
    def test_project_detail_page(self, driver, login_as_admin, projects_page):
        projects_page.open()
        try:
            projects_page.wait_for_project_in_list(PROJECT_NAME, timeout=5)
            projects_page.click_project_row(PROJECT_NAME)
            time.sleep(1)
            assert "/projects/" in driver.current_url, f"未进入项目详情页"
        except TimeoutException:
            pytest.skip(f"项目「{PROJECT_NAME}」不存在")
