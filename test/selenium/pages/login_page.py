from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class LoginPage:
    URL = "/login"

    def __init__(self, driver):
        self.driver = driver

    def open(self):
        from config import BASE_URL, WAIT_MEDIUM
        self.driver.get(f"{BASE_URL}{self.URL}")
        WebDriverWait(self.driver, WAIT_MEDIUM).until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder='用户名']"))
        )

    def login(self, username, password):
        from config import WAIT_MEDIUM
        wait = WebDriverWait(self.driver, WAIT_MEDIUM)
        username_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder='用户名']"))
        )
        username_input.clear()
        username_input.send_keys(username)

        password_input = self.driver.find_element(By.XPATH, "//input[@placeholder='密码']")
        password_input.clear()
        password_input.send_keys(password)

        login_btn = self.driver.find_element(
            By.XPATH, "//button[contains(@class, 'ant-btn-primary') and @type='submit']"
        )
        login_btn.click()

    def wait_for_success(self, timeout=None):
        from config import WAIT_LONG
        t = timeout or WAIT_LONG
        wait = WebDriverWait(self.driver, t)
        wait.until(lambda d: "/login" not in d.current_url)
        return self.driver.current_url

    def get_error_message(self, timeout=None):
        from config import WAIT_MEDIUM
        t = timeout or WAIT_MEDIUM
        wait = WebDriverWait(self.driver, t)
        el = wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "ant-message-notice-content"))
        )
        return el.text

    def is_on_login_page(self):
        return "/login" in self.driver.current_url
