from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from config import WAIT_SHORT, WAIT_MEDIUM


class NotificationPage:
    URL = "/notifications"

    def __init__(self, driver):
        self.driver = driver

    def open(self):
        from config import BASE_URL
        self.driver.get(f"{BASE_URL}{self.URL}")
        WebDriverWait(self.driver, WAIT_MEDIUM).until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[contains(@class, 'ant-list') or contains(@class, 'ant-layout')]")
            )
        )

    def get_unread_count_badge(self):
        try:
            el = self.driver.find_element(By.XPATH, "//span[contains(@class, 'ant-badge-count')]")
            text = el.text
            return int(text) if text.isdigit() else 0
        except Exception:
            return 0

    def get_notification_count(self):
        try:
            items = self.driver.find_elements(By.XPATH, "//div[contains(@class, 'ant-list-item')]")
            return len(items)
        except Exception:
            return 0

    def click_mark_as_read(self, index=0):
        btns = self.driver.find_elements(
            By.XPATH, "//button[contains(normalize-space(.), '标为已读')]"
        )
        if btns and len(btns) > index:
            btns[index].click()

    def click_mark_all_read(self):
        wait = WebDriverWait(self.driver, WAIT_SHORT)
        btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//a[contains(normalize-space(.), '全部已读')]")
            )
        )
        btn.click()

    def get_notification_titles(self):
        titles = self.driver.find_elements(
            By.XPATH, "//div[contains(@class, 'ant-list-item-meta-title')]//a"
        )
        return [t.text for t in titles]

    def switch_to_all_tab(self):
        wait = WebDriverWait(self.driver, WAIT_SHORT)
        tab = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//div[contains(@class, 'ant-tabs-tab')]//div[contains(translate(., ' ', ''), '全部消息')]")
            )
        )
        tab.click()

    def switch_to_unread_tab(self):
        wait = WebDriverWait(self.driver, WAIT_SHORT)
        tab = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//div[contains(@class, 'ant-tabs-tab')]//div[contains(translate(., ' ', ''), '未读消息')]")
            )
        )
        tab.click()

    def is_any_notification_visible(self):
        try:
            WebDriverWait(self.driver, 3).until(
                EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'ant-list-item')]"))
            )
            return True
        except TimeoutException:
            return False
