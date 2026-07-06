## **API Integration: SMS Service** 

## **1. Connect to OAuth Server and Retrieve Access Token** 

This step demonstrates retrieving an OAuth 2.0 access token using the **Client Credentials Grant** . 

## **1.1 Encode Client Credentials** 

Concatenate `clientId` and `clientSecret` using a colon ( `:` ) separator. 

## `<clientId>:<clientSecret>` 

Base64 encode the resulting string. 

## **Example:** 

||**Value**|
|---|---|
|Client ID|`ho_client`|
|Client Secret|`hO!$CL`|
|Concatenated|`ho_client:hO!$CL`|
|Base64 Encoded|`aG9fY2xpZW50OmhPISRDTA==`|



## **1.2 Send Token Request** 

- **HTTP Method:** `POST` 

- **Endpoint:** `https://marigold.medplusindia.com:6728/oauth-server/oauth/token? grant_type=client_credentials` 

## **Headers:** 

## `Authorization: Basic <Base64EncodedClientCredentials>` 

## **Example cURL Command:** 

## `curl -X POST \` 

- `"https://marigold.medplusindia.com:6728/oauth-server/oauth/token?grant_type=client_credentials" \ -H "Authorization: Basic aG9fY2xpZW50OmhPISRDTA=="` 

## **Sample Response:** 

```
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 119,
  "scope": "read",
  "env": "marigold",
  "issued_at": "2026-06-30 11:00:00",
  "jti": "804c8465-dfa1-426e-8fdf-6f1920bb0fc0"
}
```

_**Note:**_ _`access_token` is valid for_ _`expires_in` seconds (here, 119 seconds). Always check expiry before making API calls._ 

1 / 4 

## **2. Send SMS Using Access Token** 

Use this API to send an SMS to a customer. The request is enqueued asynchronously; the API returns immediately upon successful queue placement. 

- **HTTP Method:** `POST` 

- **Endpoint:** `/message-service/sms/send-sms` 

## **Headers:** 

```
Authorization: Bearer <AccessToken>
Content-Type: application/json
```

## **Request Parameters** 

## **Request Body** 

|**Field**|**Type**|**Mandatory**|**Description**|||||||
|---|---|---|---|---|---|---|---|---|---|
|mobile|String|Yes|Customer mobile number. Must be a valid Indian mobile<br>with 6/7/8/9)|||number (10||digits, starting||
|smsTemplate|String|Yes|Valid SMS template configured in the system. Example:|||`REGISTRATION_OTP`||||
|smsParams|Array|No|List of parameters based on SMS template configuration. Example:<br>`"2hr"]`|||||`["123456",`||
|customerId|String|No|Customer ID for communication logging|||||||
|referenceId|String|No|Reference ID (e.g., order ID) associated with this SMS|||||||
|referenceType|String|No|Type of reference. Allowed values:<br>`MART`,<br>`LAB` <br>`OPTICALS`,<br>`PB_ORDER`,<br>`REDEMPTION`|,|<br>`DOCTORS`,||<br>`PRESCRIPTION`||,|
|createdBy|String|No|Identifier of the caller initiating the SMS request|||||||
|remarks|String|No|Optional remarks/reason for sending this SMS|||||||



## **Query Parameters** 

|**Field**|**Type**|**Mandatory**|**Description**||||
|---|---|---|---|---|---|---|
||||Comma-separated list of mobile numbers for bulk SMS. Example:||||
|mobileNumbers|String|No|`9876543210,9876543211`|. When provided, the|`mobile`|field in the body is ignored|
||||and SMS is sent to each number in the list||||



## **Important Notes** 

_1._ _`smsTemplate` must already exist and be configured in the system._ 

_2._ _`mobile` must be a valid Indian mobile number matching the pattern: starts with 6/7/8/9, 10 digits._ 

_3. The API is_ _**asynchronous** — it returns immediately after enqueuing the request. Actual SMS delivery happens via a background queue consumer._ 

_4. A daily rate limit of_ _**20 SMS per mobile number** is enforced (configurable)._ 

_5. For bulk send using_ _`mobileNumbers` , failure on one number does not stop processing of remaining numbers._ 

## **Example Request Body** 

```
{
```

```
  "mobile": "9876543210",
  "smsTemplate": "REGISTRATION_OTP",
```

2 / 4 

```
  "smsParams": [
    "123456",
    "2hr"
  ],
  "customerId": "CUST001",
  "referenceId": "ORD12345",
  "referenceType": "MART",
  "createdBy": "OTG01057",
  "remarks": "Registration OTP"
}
```

## **Example cURL Command** 

```
curl -X POST \
```

```
  "https://marigold.medplusindia.com:6728/message-service/sms/send-sms" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210",
    "smsTemplate": "REGISTRATION_OTP",
    "smsParams": ["123456", "2hr"]
  }'
```

## **Example cURL Command (Bulk Send)** 

```
curl -X POST \
```

```
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
```

```
  -H "Content-Type: application/json" \
  -d '{
    "smsTemplate": "REGISTRATION_OTP",
    "smsParams": ["123456", "2hr"]
  }'
```

## **Sample Response** 

```
{
  "status": "SUCCESS",
  "message": "null",
  "data": {
    "status": "SUCCESS",
    "message": "SmsRequest Received Successfully"
  },
  "error": null
}
```

## **Sample Error Response** 

```
{
```

```
  "status": "SUCCESS",
  "message": "null",
  "data": {
    "status": "ERROR",
    "message": "INVALID_MOBILE_NUMBER"
```

3 / 4 

```
  "error": null
}
```

## **3. Decode SMS Text Using Access Token** 

Use this API to preview the final SMS text by substituting template placeholders with provided parameters. 

- **HTTP Method:** `POST` 

- **Endpoint:** `/message-service/sms/decode-sms-text` 

## **Headers:** 

```
Authorization: Bearer <AccessToken>
Content-Type: application/json
```

## **Request Parameters** 

|**Field**|**Type**|**Mandatory**|**Description**|
|---|---|---|---|
|smsTemplate|String|Yes|Valid SMS template configured in the system|
|smsParams|Array|Yes|List of parameters to substitute into the template|



## **Example Request Body** 

```
{
  "smsTemplate": "REGISTRATION_OTP",
  "smsParams": [
    "123456",
    "2hr"
  ]
}
```

## **Example cURL Command** 

```
curl -X POST \
  "https://marigold.medplusindia.com:6728/message-service/sms/decode-sms-text" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "smsTemplate": "REGISTRATION_OTP",
    "smsParams": ["123456", "2hr"]
  }'
```

## **Sample Response** 

```
{
  "status": "SUCCESS",
  "message": "null",
  "data": "123456 is the authorisation code for your Medplus registration.
          Please use it within 2hr. Thanks, Customer Care 040-67006700",
  "error": null
}
```

4 / 4 

