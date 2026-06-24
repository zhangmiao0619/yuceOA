#!/usr/bin/env python3
import sys
import os
import subprocess
import shutil

os.chdir(os.path.dirname(os.path.abspath(__file__)))

os.makedirs("screenshots", exist_ok=True)
os.makedirs("reports", exist_ok=True)

print("=" * 60)
print(" OA系统 Selenium 自动化测试")
print("=" * 60)

print("\n[1/3] 安装/检查依赖...")
subprocess.run(
    [sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "-q"],
    check=False,
)

print("\n[2/3] 运行测试...")
result = subprocess.run(
    [
        sys.executable, "-m", "pytest",
        "tests/",
        "-v",
        "--html=reports/report.html",
        "--self-contained-html",
        "--tb=short",
    ]
)

print(f"\n[3/3] 测试完成，退出码: {result.returncode}")
print(f"   HTML报告: reports/report.html")
print(f"   截图目录: screenshots/")

if result.returncode == 0:
    print("\n✅ 全部测试通过!")
else:
    print(f"\n❌ {result.returncode} 个测试失败，详情见报告")

sys.exit(result.returncode)
