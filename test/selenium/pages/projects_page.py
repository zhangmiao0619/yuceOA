from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException
from config import WAIT_SHORT, WAIT_MEDIUM, WAIT_LONG
import time
from pages.antd_helpers import js_set_value, js_set_textarea, click_with_scroll, select_antd_option


class ProjectsPage:
    URL = "/projects"

    def __init__(self, driver):
        self.driver = driver

    def open(self):
        from config import BASE_URL
        self.driver.get(f"{BASE_URL}{self.URL}")
        WebDriverWait(self.driver, WAIT_MEDIUM).until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[contains(@class, 'ant-table') or contains(@class, 'ant-layout')]")
            )
        )

    def _click_by_text(self, tag, text, parent="", timeout=WAIT_MEDIUM):
        wait = WebDriverWait(self.driver, timeout)
        xpath = f"{parent}//{tag}[contains(translate(., ' ', ''), '{text}')]"
        el = wait.until(EC.presence_of_element_located((By.XPATH, xpath)))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", el)
        time.sleep(0.3)
        self.driver.execute_script("arguments[0].click();", el)
        return el

    def _find_by_text(self, tag, text, parent="", timeout=WAIT_MEDIUM):
        wait = WebDriverWait(self.driver, timeout)
        xpath = f"{parent}//{tag}[contains(translate(., ' ', ''), '{text}')]"
        return wait.until(EC.presence_of_element_located((By.XPATH, xpath)))

    def _scroll_modal_top(self):
        try:
            mb = self.driver.find_element(By.XPATH, "//div[contains(@class, 'ant-modal-body')]")
            self.driver.execute_script("arguments[0].scrollTop = 0", mb)
        except Exception:
            pass

    def click_new_project(self):
        self._click_by_text("button", "新建项目")

    def fill_project_form(self, project_data):
        wait = WebDriverWait(self.driver, WAIT_MEDIUM)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "ant-modal")))

        if "name" in project_data:
            js_set_value(self.driver, "//input[@id='name']", project_data["name"])

        if "description" in project_data:
            js_set_textarea(self.driver, "//textarea[@id='description']", project_data["description"])

        if "clientShortName" in project_data:
            self._select_modal_field("clientShortName", project_data["clientShortName"])

        if "startDate" in project_data:
            self._fill_date("startDate", project_data["startDate"])

        if "endDate" in project_data:
            self._fill_date("endDate", project_data["endDate"])

        if "workload" in project_data:
            js_set_value(self.driver, "//input[@id='workload']", str(project_data["workload"]))

        if "remarks" in project_data:
            js_set_textarea(self.driver, "//textarea[@id='remarks']", project_data["remarks"])

    def add_sub_task(self, index, task_data):
        self._click_by_text("button", "添加子任务")
        time.sleep(1)

        if "title" in task_data:
            js_set_value(self.driver, f"//input[@id='subTasks_{index}_title']", task_data["title"])

        if "assigneeId" in task_data:
            self._select_subtask_assignee(index, task_data["assigneeId"])

    def _select_modal_field(self, field_id, value):
        try:
            select_antd_option(
                self.driver,
                f"//input[@id='{field_id}']/ancestor::div[contains(@class, 'ant-select-selector')]",
                value,
            )
        except Exception as e:
            pass

    def _select_subtask_assignee(self, index, name):
        try:
            select_antd_option(
                self.driver,
                f"//input[@id='subTasks_{index}_assigneeId']/ancestor::div[contains(@class, 'ant-select-selector')]",
                name,
            )
        except Exception:
            pass

    def _fill_date(self, field_id, date_str):
        try:
            inp = WebDriverWait(self.driver, WAIT_SHORT).until(
                EC.presence_of_element_located((By.XPATH, f"//input[@id='{field_id}']"))
            )
            inp.clear()
            inp.send_keys(date_str)
            inp.send_keys(Keys.ENTER)
        except Exception:
            pass

    def click_save_draft(self):
        self._click_by_text("button", "保存草稿", parent="//div[contains(@class, 'ant-modal-footer')]")

    def click_save_and_submit(self):
        self._click_by_text("button", "保存并提交", parent="//div[contains(@class, 'ant-modal-footer')]")

    def click_submit_project(self):
        self._click_by_text("button", "提交项目")

    def wait_for_project_in_list(self, project_name, timeout=None):
        t = timeout or WAIT_LONG
        wait = WebDriverWait(self.driver, t)
        return wait.until(
            EC.presence_of_element_located(
                (By.XPATH, f"//td[contains(translate(., ' ', ''), '{project_name}')]")
            )
        )

    def click_project_row(self, project_name):
        wait = WebDriverWait(self.driver, WAIT_MEDIUM)
        link = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, f"//a[contains(translate(., ' ', ''), '{project_name}')]")
            )
        )
        # The Ant Design table link may need JS click
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
        time.sleep(0.3)
        self.driver.execute_script("arguments[0].click();", link)

    def get_project_status(self, project_name):
        try:
            el = WebDriverWait(self.driver, WAIT_SHORT).until(
                EC.presence_of_element_located(
                    (By.XPATH, f"//td[contains(translate(., ' ', ''), '{project_name}')]/following-sibling::td//span[contains(@class, 'ant-tag')]")
                )
            )
            return el.text
        except Exception:
            return None

    def filter_by_name(self, name):
        inp = WebDriverWait(self.driver, WAIT_SHORT).until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder='项目名称']"))
        )
        inp.clear()
        inp.send_keys(name)
        inp.send_keys(Keys.ENTER)

    def filter_by_status(self, status_text):
        wait = WebDriverWait(self.driver, WAIT_SHORT)
        sel = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "(//div[contains(@class, 'ant-select')]//div[contains(@class, 'ant-select-selector')])[2]")
            )
        )
        sel.click()
        time.sleep(0.3)
        opt = wait.until(
            EC.element_to_be_clickable((By.XPATH, f"//div[@title='{status_text}']"))
        )
        opt.click()

    def click_reset_filter(self):
        self._click_by_text("button", "重置")

    def get_project_count(self):
        try:
            rows = WebDriverWait(self.driver, WAIT_SHORT).until(
                EC.presence_of_all_elements_located((By.XPATH, "//table/tbody/tr"))
            )
            return len(rows)
        except Exception:
            return 0

    def get_total_text(self):
        try:
            el = self.driver.find_element(By.XPATH, "//span[contains(text(), '共') and contains(text(), '条')]")
            return el.text
        except Exception:
            return ""

    def is_create_button_present(self):
        try:
            self.driver.find_element(By.XPATH, "//button[contains(normalize-space(.), '新建项目')]")
            return True
        except Exception:
            return False

    def is_edit_button_present(self):
        try:
            self.driver.find_element(By.XPATH, "//button[contains(normalize-space(.), '编辑')]")
            return True
        except Exception:
            return False

    def click_delete_project(self):
        self._click_by_text("button", "删除项目")

    def confirm_delete(self):
        self._click_by_text("button", "确定删除")

    def is_delete_button_present(self):
        try:
            self.driver.find_element(By.XPATH, "//button[contains(normalize-space(.), '删除项目')]")
            return True
        except Exception:
            return False

    def navigate_to_settings_tab(self):
        self._click_by_text("div", "设置", "//div[contains(@class, 'ant-tabs-tab')]")

    def click_submit_pause_request(self):
        self._click_by_text("button", "提交暂停申请")

    def click_archive_project(self):
        self._click_by_text("button", "归档")

    def click_view_detail(self, project_name):
        self._find_by_text("button", "查看",
            f"//td[contains(text(), '{project_name}')]/following-sibling::td")
