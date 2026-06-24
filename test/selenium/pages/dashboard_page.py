from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class DashboardPage:
    URL = "/"

    def __init__(self, driver):
        self.driver = driver

    def is_loaded(self, timeout=10):
        wait = WebDriverWait(self.driver, timeout)
        try:
            wait.until(
                EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'ant-layout')]"))
            )
            return True
        except Exception:
            return False
