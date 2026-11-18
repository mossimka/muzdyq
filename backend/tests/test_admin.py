from __future__ import annotations

from fastapi.testclient import TestClient

from .helpers import make_image, upload


def test_admin_requires_token_and_can_moderate(client: TestClient, admin_headers) -> None:
    uploaded = upload(client, make_image(label="moderate"))
    assert uploaded.status_code == 201
    photo = uploaded.json()["photo"]

    assert client.get("/api/admin/photos").status_code == 401
    assert (
        client.get("/api/admin/photos", headers={"X-Admin-Token": "wrong"}).status_code
        == 403
    )

    listing = client.get("/api/admin/photos", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["status"] == "published"

    hidden = client.post(
        f"/api/admin/photos/{photo['id']}/hide",
        json={"reason": "contains a private detail"},
        headers=admin_headers,
    )
    assert hidden.status_code == 200
    assert hidden.json()["status"] == "hidden"
    assert hidden.json()["rejection_reason"] == "contains a private detail"
    assert client.get(photo["url"]).status_code == 404
    assert client.get("/api/points/tuyuksu-glacier/photos").json()["items"] == []

    hidden_list = client.get("/api/admin/photos?status=hidden", headers=admin_headers)
    assert hidden_list.json()["total"] == 1

    published = client.post(
        f"/api/admin/photos/{photo['id']}/publish", headers=admin_headers
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert client.get(photo["url"]).status_code == 200

    deleted = client.delete(f"/api/admin/photos/{photo['id']}", headers=admin_headers)
    assert deleted.status_code == 204
    assert client.get(photo["url"]).status_code == 404
    assert client.get("/api/admin/photos", headers=admin_headers).json()["total"] == 0

    stats = client.get("/api/admin/stats", headers=admin_headers)
    assert stats.status_code == 200
    assert stats.json()["total"] == 0


def test_admin_bad_status_filter(client: TestClient, admin_headers) -> None:
    response = client.get("/api/admin/photos?status=whatever", headers=admin_headers)
    assert response.status_code == 422
