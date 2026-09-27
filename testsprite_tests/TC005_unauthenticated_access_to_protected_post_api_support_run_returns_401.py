import requests

BASE_URL = "http://localhost:5000"

def test_post_api_support_run_unauthenticated_returns_401():
    url = f"{BASE_URL}/api/support/run"
    try:
        response = requests.post(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"

test_post_api_support_run_unauthenticated_returns_401()