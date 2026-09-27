import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_get_auth_me_unauthenticated_returns_401():
    url = f"{BASE_URL}/auth/me"
    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"

test_get_auth_me_unauthenticated_returns_401()