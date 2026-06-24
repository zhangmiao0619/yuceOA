from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from config import WAIT_SHORT, WAIT_MEDIUM, WAIT_LONG
import time


class TasksPage:
    URL = "/tasks"

    def __init__(self, driver):
        self.driver = driver

    def open(self):
        from config import BASE_URL
        self.driver.get(f"{BASE_URL}{self.URL}")
        WebDriverWait(self.driver, WAIT_MEDIUM).until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[contains(@class, 'ant-card') or contains(@class, 'ant-spin-container') or contains(@class, 'ant-layout')]")
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

    def wait_for_task_cards(self, timeout=None):
        t = timeout or WAIT_MEDIUM
        wait = WebDriverWait(self.driver, t)

        def find_cards(d):
            cards = d.find_elements(By.XPATH, "//div[contains(@class, 'ant-card')]")
            if len(cards) > 0:
                return cards
            items = d.find_elements(By.XPATH, "//div[contains(@class, 'ant-table-row')]")
            if len(items) > 0:
                return items
            return None

        return wait.until(find_cards)

    def click_submit_result(self):
        self._click_by_text("button", "提交审批")

    def click_approve_button(self):
        self._click_by_text("button", "审批")

    def click_apply_end_task(self):
        self._click_by_text("button", "申请结束任务")

    def click_detail_button(self):
        self._click_by_text("button", "详情")

    def click_edit_task_button(self):
        self._click_by_text("button", "编辑")

    def click_delete_task_button(self):
        self._click_by_text("button", "删除")

    def is_task_in_list(self, title, timeout=None):
        t = timeout or WAIT_SHORT
        try:
            WebDriverWait(self.driver, t).until(
                EC.presence_of_element_located(
                    (By.XPATH, f"//td[contains(text(), '{title}')]")
                )
            )
            return True
        except TimeoutException:
            return False

    def get_task_status_text(self, title):
        try:
            el = WebDriverWait(self.driver, WAIT_SHORT).until(
                EC.presence_of_element_located(
                    (By.XPATH, f"//td[contains(text(), '{title}')]/following-sibling::td//span[contains(@class, 'ant-tag')]")
                )
            )
            return el.text
        except Exception:
            return None

    def confirm_modal_ok(self):
        wait = WebDriverWait(self.driver, WAIT_MEDIUM)
        try:
            btn = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//div[contains(@class, 'ant-modal-confirm')]//button[contains(@class, 'ant-btn-primary')]")
                )
            )
            btn.click()
        except TimeoutException:
            try:
                btn = wait.until(
                    EC.element_to_be_clickable(
                        (By.XPATH, "//div[contains(@class, 'ant-modal')]//button[contains(@class, 'ant-btn-primary')]")
                    )
                )
                btn.click()
            except TimeoutException:
                pass

    def submit_review_decision(self, action, comments=""):
        wait = WebDriverWait(self.driver, WAIT_MEDIUM)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "ant-modal")))

        try:
            sel = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//div[@id='action']//div[contains(@class, 'ant-select-selector')]")
                )
            )
            sel.click()
            time.sleep(0.3)
            opt = wait.until(
                EC.element_to_be_clickable((By.XPATH, f"//div[@title='{action}']"))
            )
            opt.click()
        except Exception:
            pass

        if action == "驳回" and comments:
            try:
                inp = wait.until(
                    EC.presence_of_element_located((By.XPATH, "//textarea[@id='comments']"))
                )
                inp.clear()
                inp.send_keys(comments)
            except Exception:
                pass

        try:
            btn = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//div[contains(@class, 'ant-modal')]//button[contains(@class, 'ant-btn-primary')]")
                )
            )
            btn.click()
        except Exception:
            pass
