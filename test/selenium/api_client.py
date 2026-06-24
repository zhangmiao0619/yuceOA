import requests

API_BASE = "http://localhost:3000/api"


def login_api(username, password):
    resp = requests.post(f"{API_BASE}/auth/login", json={"username": username, "password": password})
    data = resp.json()
    if data.get("success"):
        return data["data"]["token"]
    raise Exception(f"Login failed: {data}")


def create_project_api(token, project_data, sub_tasks=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "name": project_data.get("name"),
        "description": project_data.get("description", ""),
        "clientShortName": project_data.get("clientShortName", ""),
    }
    if sub_tasks:
        body["subTasks"] = sub_tasks
    resp = requests.post(f"{API_BASE}/projects", json=body, headers=headers)
    data = resp.json()
    if data.get("success"):
        return data["data"]
    raise Exception(f"Create project failed: {data}")


def get_project_by_name_api(token, name):
    projects = get_projects_api(token, {"name": name})
    lst = projects.get("data", {}).get("list", [])
    if lst:
        return lst[0]
    return None


def get_projects_api(token, params=None):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{API_BASE}/projects", headers=headers, params=params or {})
    return resp.json()


def get_project_detail_api(token, project_id):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{API_BASE}/projects/{project_id}", headers=headers)
    return resp.json()


def delete_project_api(token, project_id):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.delete(f"{API_BASE}/projects/{project_id}", headers=headers)
    return resp.json()


def get_tasks_api(token, params=None):
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{API_BASE}/tasks", headers=headers, params=params or {})
    return resp.json()


def submit_task_api(token, task_id, data=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    resp = requests.post(f"{API_BASE}/tasks/{task_id}/submit", json=data or {}, headers=headers)
    return resp.json()


def review_task_api(token, task_id, action, comments=""):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    resp = requests.post(f"{API_BASE}/tasks/{task_id}/review", json={"action": action, "comments": comments}, headers=headers)
    return resp.json()
