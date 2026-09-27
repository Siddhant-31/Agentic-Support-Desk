import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_authenticated_get_auth_me_returns_user_info():
    login_url = f"{BASE_URL}/auth/e2e/login"
    auth_me_url = f"{BASE_URL}/auth/me"
    login_payload = {
        "id": "e2e_user_1",
        "email": "e2e@test.local",
        "name": "E2E User"
    }
    session = requests.Session()
    try:
        # POST /auth/e2e/login to get session cookie
        login_resp = session.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_json = login_resp.json()
        assert login_json.get("ok") is True, f"Login response JSON invalid: {login_json}"
        # Verify session cookie is set (name unknown)
        cookies = session.cookies
        assert len(cookies) > 0, "No cookies found after login"

        # GET /auth/me with session cookie
        auth_me_resp = session.get(auth_me_url, timeout=TIMEOUT)
        assert auth_me_resp.status_code == 200, f"Auth me failed with status {auth_me_resp.status_code}"
        user_info = auth_me_resp.json().get("user")
        assert user_info is not None, f"No user info in response: {auth_me_resp.json()}"
        assert user_info.get("id") == login_payload["id"], f"User id mismatch: expected {login_payload['id']}, got {user_info.get('id')}"
        assert user_info.get("email") == login_payload["email"], f"User email mismatch: expected {login_payload['email']}, got {user_info.get('email')}"
    finally:
        session.close()


def test_get_status_endpoint():
    url = f"{BASE_URL}/status"
    resp = requests.get(url, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Status endpoint returned {resp.status_code}"
    json_data = resp.json()
    assert json_data.get("ok") is True, f"Status JSON invalid: {json_data}"

def test_get_auth_me_without_cookie():
    url = f"{BASE_URL}/auth/me"
    resp = requests.get(url, timeout=TIMEOUT)
    assert resp.status_code == 401, f"Expected 401 but got {resp.status_code}"

def test_post_auth_e2e_login():
    url = f"{BASE_URL}/auth/e2e/login"
    payload = {
        "id": "e2e_user_1",
        "email": "e2e@test.local",
        "name": "E2E User"
    }
    session = requests.Session()
    try:
        resp = session.post(url, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Login POST returned {resp.status_code}"
        json_resp = resp.json()
        assert json_resp.get("ok") is True, f"Login response JSON invalid: {json_resp}"
        cookies = session.cookies
        assert len(cookies) > 0, "No cookies set in login response"
    finally:
        session.close()

# Run the tests in order
test_get_status_endpoint()
test_get_auth_me_without_cookie()
test_post_auth_e2e_login()
test_authenticated_get_auth_me_returns_user_info()
