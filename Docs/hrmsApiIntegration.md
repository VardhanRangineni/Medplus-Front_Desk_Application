## **API Integration: OAuth Token Retrieval and HRMS Data Fetching** 

## **1. Connect to OAuth Server and Retrieve Access Token** 

This step demonstrates retrieving an OAuth 2.0 access token using the Client Credentials Grant. 

## **1.1 Encode Client Credentials** 

Concatenate clientId and clientSecret using a colon (:) separator. 

## <clientId>:<clientSecret> 

Base64 encode the resulting string. 

## **Example** : 

||Value|
|---|---|
|Client ID|ho_client|
|Client Secret|hO!$CL|
|Concatenated|ho_client:hO!$CL|
|Base64 Encoded|aG9fY2xpZW50OmhPISRDTA==|



## **1.2 Send Token Request** 

- **HTTP Method** : POST 

## ● **Endpoint** : 

https://iris.medplusindia.com:2728/oauth-server/oauth/token? grant_type=client_credentials 

## **Headers** : 

**Authorization** : Basic <Base64EncodedClientCredentials> 

**Example cURL Command** : 

curl -X POST \ 

"https://iris.medplusindia.com:2728/oauth-server/oauth/token 

?grant_type 

- -H "Authorization: Basic aG9fY2xpZW50OmhPISRDTA==" 

## **Sample Response** : 

{ "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...", 

"token_type": "bearer", "expires_in": 119, "scope": "read", "env": "iris", "issued_at": "2026-05-21 11:00:00", "jti": "804c8465-dfa1-426e-8fdf-6f1920bb0fc0" 

} 

**Note** :   access_token is valid for expires_in seconds (here, 119 seconds). 

## **2. Fetch Location Details Using Access Token** 

Once you have the access token, you can query the HRMS services through TPA Url. 

## **HTTP Method** : GET 

**Endpoint** : 

- /hrms/service/get-location-details?state=<STATE>&city=<CITY> **Headers** : 

**Authorization** : Bearer <AccessToken> 

**Note** : 

1. Both state and city are optional parameters. 

   - If provided, the API will filter results accordingly. 

   - If omitted, all locations will be returned. 

2. STORE and DIAGNOSTIC locations are excluded from the response. 

**Example** cURL Command: 

curl -X GET "https://iris.medplusindia.com:2728/hrms/service/ get-location-details?state=Telangana&city=Hyderabad" 

-H "Authorization: Bearer 

eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." 

## **Sample Response** : 

{ "result": "Success", "data": [ 

{ 

"facilityId": "HEAD OFFICE", "facilityName": "HEAD OFFICE", "facilityType": "Corporate Office", "latitude": 0.0, "longitude": 0.0, "line_1": "Medplus Health Services, Municipal No. 11-6-56, Block C, Survey No 257 & 258/1, Opp. IDPL Railway siding, Moosapet", "line_2": "Kukatpally, Hyderabad-500037", "locality": "", "city": "HYDERABAD", "state": "TELANGANA", "pin_code": "" } ] 

} 

## **3. Fetch Employee Details Using Access Token** 

You can retrieve employee details using the filters hrms_id , employee_id , phone_no , and status. The status accepts values ‘A’(Active) and ‘I’ (Inactive). At least one of hrms_id , employee_id , or phone_no is mandatory, while status is optional. 

- **HTTP Method:** GET 

## ● **Endpoint** : 

/hrms/service/get-employee-details?hrms_id=<HRMS_ID>&employee_ id=<EMPLOYEE_ID>&phone_no=<PHONE_NO>&status=<STATUS> 

## **Headers** : 

Authorization: Bearer <AccessToken> 

## **Example cURL Command:** 

curl -X GET \ 

"https://iris.medplusindia.com:2728/hrms/service/get-employe e-details?phone_no=8683133596&status=I&hrms_id=MED1096632" \ -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." 

## **Sample Response** : 

{ "result": "Success", "data": [ { "fullName": "N L V MADHAV", "hrmsId": "MED1096632", "employeeId": "OTG06625", "workEmail": "qdxoejgv@medplusindia.com", "workPhoneNo": "8683133596", "personalPhoneNo": "7715246085", "companyName": "Optival", "designation": "Tr. Software Engineer", "workLocation": "RO-Hyd.Software", "department": "Software", "role": "Tr. Software Engineer" } ] } Use this API to fetch employee metadata. 

