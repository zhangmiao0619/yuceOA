import os
import pytest
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager


def pytest_configure(config):
    config.option.htmlpath = "reports/report.html"
    config.option.self_contained_html = True


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        driver = item.funcargs.get("driver")
        if driver:
            os.makedirs("screenshots", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = f"screenshots/{item.name}_{timestamp}.png"
            driver.save_screenshot(filepath)


@pytest.fixture(scope="function")
def driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-logging")
    options.add_argument("--log-level=3")

    service = Service(ChromeDriverManager().install())
    d = webdriver.Chrome(service=service, options=options)
    d.implicitly_wait(5)
    yield d
    d.quit()


@pytest.fixture(scope="function")
def login_page(driver):
    from pages.login_page import LoginPage
    return LoginPage(driver)


@pytest.fixture(scope="function")
def projects_page(driver):
    from pages.projects_page import ProjectsPage
    return ProjectsPage(driver)


@pytest.fixture(scope="function")
def tasks_page(driver):
    from pages.tasks_page import TasksPage
    return TasksPage(driver)


@pytest.fixture(scope="function")
def notifications_page(driver):
    from pages.notifications_page import NotificationPage
    return NotificationPage(driver)


def login_as(driver, account):
    from pages.login_page import LoginPage
    lp = LoginPage(driver)
    lp.open()
    lp.login(account["username"], account["password"])
    return lp.wait_for_success()


@pytest.fixture(scope="function")
def login_as_admin(driver):
    from config import ACCOUNTS
    return login_as(driver, ACCOUNTS["admin"])


@pytest.fixture(scope="function")
def login_as_wangleng(driver):
    from config import ACCOUNTS
    return login_as(driver, ACCOUNTS["wangleng"])


@pytest.fixture(scope="function")
def login_as_hanpeng(driver):
    from config import ACCOUNTS
    return login_as(driver, ACCOUNTS["hanpeng"])


@pytest.fixture(scope="function")
def login_as_libo(driver):
    from config import ACCOUNTS
    return login_as(driver, ACCOUNTS["libo"])
