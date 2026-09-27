import requests

BASE_URL = "http://localhost:5000"

def test_post_auth_e2e_login_sets_session_cookie_and_returns_200():
    url = f"{BASE_URL}/auth/e2e/login"
    payload = {
        "id": "e2e_user_1",
        "email": "e2e@test.local",
        "name": "E2E User"
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

        json_response = response.json()
        assert json_response == {"ok": True}, f"Expected response {{'ok': True}}, got {json_response}"

        # Check for httpOnly session cookie
        cookies = response.cookies
        assert cookies, "Expected to receive cookies but none were set."

        http_only_cookie_found = False
        # requests.Response.cookies only has cookie names and values, httpOnly flag is not directly accessible,
        # so we check cookies from headers manually for httpOnly flag
        set_cookie_headers = response.headers.getlist("Set-Cookie") if hasattr(response.headers, 'getlist') else response.headers.get("Set-Cookie")
        if set_cookie_headers:
            # If multiple cookies, set_cookie_headers may be a list or a string
            if isinstance(set_cookie_headers, str):
                set_cookie_headers = [set_cookie_headers]
            for cookie_header in set_cookie_headers:
                if 'HttpOnly' in cookie_header:
                    http_only_cookie_found = True
                    break
        # fallback: if getlist unavailable and only single header
        if not http_only_cookie_found and isinstance(set_cookie_headers, str):
            http_only_cookie_found = 'HttpOnly' in set_cookie_headers

        assert http_only_cookie_found, "Expected httpOnly session cookie to be set in the response."

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_auth_e2e_login_sets_session_cookie_and_returns_200()