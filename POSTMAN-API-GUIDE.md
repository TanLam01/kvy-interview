# Huong dan test API bang Postman

Tai lieu nay mo ta cach test backend `kvy-be` sau khi da chay:

```powershell
cd kvy-be
npm run start:dev
```

## 1. Kiem tra backend dang chay

Base URL:

```text
http://localhost:3000/api
```

Tao request:

```http
GET http://localhost:3000/api
```

Ket qua mong doi:

```text
Hello World!
```

Neu Postman bao `ECONNREFUSED`, kiem tra terminal backend, PostgreSQL va Redis.

## 2. Tao Postman Environment

Trong Postman, tao Environment ten `KVY Local` voi cac bien:

| Variable | Initial value |
| --- | --- |
| `baseUrl` | `http://localhost:3000/api` |
| `sellerToken` | De trong |
| `adminToken` | De trong |
| `verificationId` | De trong |
| `documentId` | De trong |
| `webhookSecret` | Gia tri `WEBHOOK_SECRET` trong `kvy-be/.env` |

Chon environment `KVY Local` truoc khi gui request.

## 3. Tai khoan test

| Role | Email | Password |
| --- | --- | --- |
| Seller | `seller1@kvy.tech` | `password123` |
| Seller | `seller2@kvy.tech` | `password123` |
| Admin | `admin@kvy.tech` | `adminpassword` |

Co the xem danh sach tai khoan bang:

```http
GET {{baseUrl}}/auth/seeds
```

Endpoint nay chi hoat dong khi `SHOW_SEED_CREDENTIALS=true`.

## 4. Login seller

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
```

Body -> `raw` -> `JSON`:

```json
{
  "email": "seller1@kvy.tech",
  "password": "password123"
}
```

Response mau:

```json
{
  "token": "eyJ...",
  "user": {
    "id": "seller_1",
    "email": "seller1@kvy.tech",
    "role": "SELLER"
  }
}
```

Trong tab `Scripts` -> `Post-response`, them:

```javascript
pm.environment.set("sellerToken", pm.response.json().token);
```

## 5. Upload document cua seller

```http
POST {{baseUrl}}/seller/documents
Authorization: Bearer {{sellerToken}}
```

Trong Postman:

1. Chon tab `Authorization`.
2. Chon type `Bearer Token`.
3. Nhap `{{sellerToken}}`.
4. Chon `Body` -> `form-data`.
5. Them hai field sau:

| Key | Type | Value |
| --- | --- | --- |
| `file` | File | Chon mot file PDF, PNG, JPG hoac JPEG |
| `documentType` | Text | `business_license` hoac `tax_registration` |

Khong tu them header `Content-Type`. Postman se tu tao `multipart/form-data` kem boundary.

Gioi han file:

- Dinh dang: `.pdf`, `.png`, `.jpg`, `.jpeg`
- Kich thuoc toi da: `5 MB`

Response mau:

```json
{
  "document": {
    "id": "document-uuid",
    "sellerId": "seller_1",
    "fileName": "saved-file-name.pdf",
    "documentType": "business_license"
  },
  "verification": {
    "id": "verification-uuid",
    "documentId": "document-uuid",
    "sellerId": "seller_1",
    "status": "QUEUED"
  }
}
```

Trong tab `Scripts` -> `Post-response`, them:

```javascript
const response = pm.response.json();
pm.environment.set("verificationId", response.verification.id);
pm.environment.set("documentId", response.document.id);
```

Sau upload, worker se gui request den mock verifier. Ket qua tu dong thuong ve sau khoang `5-15 giay`.

## 6. Xem trang thai seller

```http
GET {{baseUrl}}/seller/documents/status
Authorization: Bearer {{sellerToken}}
```

Trang thai co the gap:

| Status | Y nghia |
| --- | --- |
| `UNSUBMITTED` | Seller chua upload document |
| `QUEUED` | Dang cho worker xu ly |
| `PROCESSING` | Da gui sang verifier, dang cho callback |
| `UNDER_MANUAL_REVIEW` | Ket qua inconclusive, cho admin |
| `VERIFIED` | Da duoc chap nhan |
| `REJECTED` | Da bi tu choi |
| `NEEDS_ATTENTION` | Da het so lan retry, can xu ly van hanh |

Luu y: seller khong the upload them khi dang `QUEUED`, `PROCESSING`,
`UNDER_MANUAL_REVIEW` hoac da `VERIFIED`.

## 7. Login admin

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "admin@kvy.tech",
  "password": "adminpassword"
}
```

Trong tab `Scripts` -> `Post-response`, them:

```javascript
pm.environment.set("adminToken", pm.response.json().token);
```

## 8. Lay danh sach cho admin review

```http
GET {{baseUrl}}/admin/verifications/pending
Authorization: Bearer {{adminToken}}
```

API chi tra ve cac verification co status:

```text
UNDER_MANUAL_REVIEW
```

Neu response la `[]`, nghia la hien tai khong co document inconclusive.

## 9. Xem lich su verification

```http
GET {{baseUrl}}/admin/verifications/{{verificationId}}/history
Authorization: Bearer {{adminToken}}
```

Response gom document, trang thai hien tai va danh sach audit events.

## 10. Admin xem tat ca attempts va tai document

Lay toi da 100 verification attempts gan nhat:

```http
GET {{baseUrl}}/admin/verifications
Authorization: Bearer {{adminToken}}
```

Tai document cua mot verification:

```http
GET {{baseUrl}}/admin/verifications/{{verificationId}}/document
Authorization: Bearer {{adminToken}}
```

## 11. Admin approve hoac reject

API nay chi chay khi verification dang o `UNDER_MANUAL_REVIEW`.

### Approve

```http
POST {{baseUrl}}/admin/verifications/{{verificationId}}/decision
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

Body:

```json
{
  "action": "verify",
  "reason": "Document hop le sau khi kiem tra thu cong"
}
```

### Reject

```json
{
  "action": "reject",
  "reason": "Document khong ro rang hoac khong hop le"
}
```

`action` chi chap nhan:

```text
verify
reject
```

`reason` la optional.

## 12. Ep flow inconclusive de test admin

Mock verifier tra ket qua ngau nhien, nen khong phai lan upload nao cung vao manual review.
De test admin chac chan, can gui webhook thu cong trong luc verification dang
`PROCESSING`.

Truoc tien goi API status seller de lay `verificationId` va `documentId`, sau do gui:

```http
POST {{baseUrl}}/verifier-webhook
Content-Type: application/json
x-verifier-signature: <HMAC-SHA256 signature>
```

Body:

```json
{
  "verificationId": "{{verificationId}}",
  "documentId": "{{documentId}}",
  "status": "inconclusive",
  "reason": "Manual Postman test: document khong du ro"
}
```

Webhook bat buoc co chu ky HMAC. Trong tab `Scripts` -> `Pre-request`, them:

```javascript
const CryptoJS = pm.require("npm:crypto-js@4.2.0");
const sortObject = (value) => {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObject(value[key]);
        return result;
      }, {});
  }
  return value;
};

const rawBody = JSON.stringify(
  sortObject(JSON.parse(pm.variables.replaceIn(pm.request.body.raw)))
);
const signature = CryptoJS.HmacSHA256(
  rawBody,
  pm.environment.get("webhookSecret")
).toString();

pm.request.headers.upsert({
  key: "x-verifier-signature",
  value: signature
});
```

`status` chi chap nhan:

```text
verified
rejected
inconclusive
```

Sau do:

1. Goi `GET {{baseUrl}}/admin/verifications/pending`.
2. Goi API admin decision de approve hoac reject.
3. Goi lai seller status de xem ket qua cuoi.

Luu y: webhook chi duoc xu ly khi verification dang `PROCESSING`. Neu callback den
khi verification o state khac, response se co `status: "ignored"`.

## 13. Goi truc tiep mock verifier

API nay chu yeu dung de test mock external service. Flow upload binh thuong se tu
goi API nay, khong can goi thu cong.

```http
POST {{baseUrl}}/mock-verifier/verify
Content-Type: application/json
```

Body:

```json
{
  "verificationId": "{{verificationId}}",
  "documentId": "{{documentId}}",
  "documentType": "business_license",
  "callbackUrl": "{{baseUrl}}/verifier-webhook"
}
```

Response thanh cong:

```http
202 Accepted
```

Neu vuot qua `100 calls/minute`:

```http
429 Too Many Requests
```

## 14. Thu tu test end-to-end de xuat

1. `GET {{baseUrl}}` de kiem tra backend.
2. Login seller va luu `sellerToken`.
3. Upload document va luu `verificationId`, `documentId`.
4. Goi seller status cho den khi state thay doi.
5. Neu muon test admin chac chan, gui webhook `inconclusive` khi dang `PROCESSING`.
6. Login admin va luu `adminToken`.
7. Lay pending reviews.
8. Xem history.
9. Admin approve hoac reject.
10. Goi lai seller status de xem final outcome.

## 15. Loi thuong gap

### `401 Unauthorized`

Kiem tra:

```text
Authorization: Bearer {{sellerToken}}
```

hoac:

```text
Authorization: Bearer {{adminToken}}
```

Token seller khong goi duoc API admin va token admin khong goi duoc API seller.

### `400 Bad Request` khi upload

Kiem tra:

- Body dang `form-data`.
- Field file co ten chinh xac la `file`.
- Field document type co ten chinh xac la `documentType`.
- `documentType` la `business_license` hoac `tax_registration`.
- File dung dinh dang va khong vuot qua `5 MB`.

### Khong thay pending review

Verification phai co status `UNDER_MANUAL_REVIEW`. Dung flow webhook inconclusive
o muc 12 de tao state nay.

### `Cannot make decision on verification`

Admin decision chi duoc phep khi status dang la:

```text
UNDER_MANUAL_REVIEW
```

### Backend khong ket noi duoc

Dam bao cac dich vu dang chay:

```text
PostgreSQL: localhost:5432
Redis:      localhost:6379
Backend:    localhost:3000
```
