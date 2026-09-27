import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_get_status_returns_ok_true():
    url = f"{BASE_URL}/status"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        json_data = response.json()
        assert "ok" in json_data, "Response JSON does not contain 'ok'"
        assert json_data["ok"] is True, f"Expected ok to be True, got {json_data['ok']}"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

test_get_status_returns_ok_true()