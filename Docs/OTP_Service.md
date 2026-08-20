# OTP APIs — MessageService

This url is for reference, works in Madhapur office (Test env url)
Base URL: `http://192.168.0.73:32110`

---

## 1. Send OTP

Generates and sends an OTP to the customer via SMS, Email, or both.

**POST** `/otp/send-customer-otp`

### Request Body

| Field             | Type              | Required      | Description                                                                   |
|-------------------|-------------------|---------------|-------------------------------------------------------------------------------|
| `vertical`        | String            | Yes           | Business vertical, e.g. `MART`                                                |
| `smsTemplate`     | String            | Yes           | Template name registered in the system, e.g. `CRM_ORDER_ONLINE_PAYMENT`               |
| `smsParams`       | List\<String\>    | Yes           | Template substitution params. OTP is auto-injected at the configured position |
| `requestedBy`     | String            | Yes           | Identifies the calling service                                                | 
| `mobile`          | String            | Conditional   | Indian mobile number. Required when `otpOn` is `SMS` or `BOTH`                |
| `email`           | String            | Conditional   | Valid email address. Required when `otpOn` is `EMAIL` or `BOTH`               |
| `mailIdentifier`  | String            | Conditional   | Required when `otpOn` is `EMAIL` or `BOTH`                                    |
| `otpOn`           | Enum              | No            | `SMS` (default), `EMAIL`, `BOTH`                                              |
| `otpRequestType`  | Enum              | No            | `GENERATE` (default — new OTP), `RESEND` (reuse existing OTP)                 |
| `mailSubject`     | String            | No            | Email subject. Defaults to `"One-time Password(OTP)"`                         |
| `priority`        | Enum              | No            | `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, `CRITICAL`. Recommended: `CRITICAL`    |

### Response

```json
{
  "status": "SUCCESS",
  "data": {
    "status": "SUCCESS",
    "message": null
  }
}
```

On failure:
```json
{
  "status": "SUCCESS",
  "data": {
    "status": "ERROR",
    "message": "Otp sms template not registered with system"
  }
}
```

### cURL — Send via SMS

```bash
curl -X POST http://<host>:<port>/otp/send-customer-otp \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210",
    "vertical": "MART",
    "smsTemplate": "CRM_ORDER_ONLINE_PAYMENT",
    "smsParams": ["CustomerName"],
    "otpOn": "SMS",
    "otpRequestType": "GENERATE",
    "priority": "CRITICAL",
    "requestedBy": "REGISTRATION_SERVICE"
  }'
```

### cURL — Send via Email

```bash
curl -X POST http://<host>:<port>/otp/send-customer-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "vertical": "MART",
    "smsTemplate": "CRM_ORDER_ONLINE_PAYMENT",
    "smsParams": ["CustomerName"],
    "otpOn": "EMAIL",
    "mailIdentifier": "REGISTRATION_MAIL",
    "mailSubject": "Your OTP",
    "priority": "CRITICAL",
    "requestedBy": "REGISTRATION_SERVICE"
  }'
```

### cURL — Send via Both SMS and Email

```bash
curl -X POST http://<host>:<port>/otp/send-customer-otp \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210",
    "email": "user@example.com",
    "vertical": "MART",
    "smsTemplate": "CRM_ORDER_ONLINE_PAYMENT",
    "smsParams": ["CustomerName"],
    "otpOn": "BOTH",
    "mailIdentifier": "REGISTRATION_MAIL",
    "priority": "CRITICAL",
    "requestedBy": "REGISTRATION_SERVICE"
  }'
```

### cURL — Resend OTP

```bash
curl -X POST http://<host>:<port>/otp/send-customer-otp \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210",
    "vertical": "MART",
    "smsTemplate": "CRM_ORDER_ONLINE_PAYMENT",
    "smsParams": ["CustomerName"],
    "otpOn": "SMS",
    "otpRequestType": "RESEND",
    "priority": "CRITICAL",
    "requestedBy": "REGISTRATION_SERVICE"
  }'
```

---


## Error Reference

| Message | Cause |
|---|---|
| `"Invalid otp request"` | Request body is null or empty |
| `"Invalid sms template"` | `smsTemplate` field is blank |
| `"Empty vertical info"` | `vertical` field is blank |
| `"Mobile number is mandatory"` | Mobile missing when `otpOn` is `SMS` or `BOTH` |
| `"Invalid email address"` | Email missing or invalid when `otpOn` is `EMAIL` or `BOTH` |
| `"Invalid Mail Identifier"` | `mailIdentifier` missing when `otpOn` is `EMAIL` or `BOTH` |
| `"Invalid requested by"` | `requestedBy` field is blank |
| `"Otp sms template not registered with system"` | Template not found in `tbl_customer_otp_config` |
| `"OtpPosition exceeds SmsTemplate params"` | Configured OTP insert position > length of `smsParams` |
| `"Maximum otp request exceeded. Please try again after {X} minutes"` | Hit `maxOtpCount` limit for the template |
| `"Otp is mandatory"` | `otp` field missing in verify request |
| `"Invalid mobile/Email"` | `source` is not a valid mobile or email |
| `"Invalid OTP"` | OTP does not match stored value |
| `"Otp expired. Please regenerate new otp."` | OTP TTL elapsed, no entry in Redis |
