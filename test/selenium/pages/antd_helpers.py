from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from config import WAIT_SHORT, WAIT_MEDIUM
import time


def js_set_value(driver, element_or_xpath, value):
    """Set value on an Ant Design input field using JS to trigger React change detection."""
    if isinstance(element_or_xpath, str):
        element = driver.find_element(By.XPATH, element_or_xpath)
    else:
        element = element_or_xpath

    driver.execute_script("""
        var input = arguments[0];
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(input, arguments[1]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    """, element, value)


def js_set_textarea(driver, element_or_xpath, value):
    """Set value on an Ant Design textarea using JS."""
    if isinstance(element_or_xpath, str):
        element = driver.find_element(By.XPATH, element_or_xpath)
    else:
        element = element_or_xpath

    driver.execute_script("""
        var ta = arguments[0];
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(ta, arguments[1]);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
    """, element, value)


def click_with_scroll(driver, element, timeout=WAIT_MEDIUM):
    """Scroll element into view and click it."""
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    time.sleep(0.3)
    wait = WebDriverWait(driver, timeout)
    clickable = wait.until(EC.element_to_be_clickable(element))
    clickable.click()


def select_antd_option(driver, select_trigger_xpath, option_text, timeout=WAIT_MEDIUM):
    """Click an Ant Design Select trigger and pick an option by title."""
    wait = WebDriverWait(driver, timeout)
    trigger = wait.until(EC.element_to_be_clickable((By.XPATH, select_trigger_xpath)))
    click_with_scroll(driver, trigger, timeout)
    time.sleep(0.5)
    opt = wait.until(
        EC.element_to_be_clickable((By.XPATH, f"//div[@title='{option_text}' and contains(@class, 'ant-select-item')]"))
    )
    opt.click()
