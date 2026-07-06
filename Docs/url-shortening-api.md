## **URL Shortening Service API** 

## **Base URL** 

```
https://mdpls.in
```

## **Authentication** 

**None.** All endpoints are publicly accessible with no authentication required. 

## **Endpoints** 

## **1. Create Short URL** 

**Endpoint:** `GET /shorten-api/shorten` 

|**Parameter**|**Type**|**Required**|**Description**||||
|---|---|---|---|---|---|---|
|`longUrl`|String|Yes|The original URL to shorten. Must start with|<br>`http://`|or|<br>`https://`|
|`noOfDays`|Integer|**No**|Expiry in days. Must be between**1 and 365**. If omitted, defaults to**30 days**||||



## **Validation rules:** 

- `longUrl` cannot be null or empty 

- `longUrl` must start with `http://` or `https://` 

- `noOfDays` , if provided, must be between **1 and 365** (inclusive) 

**Response format:** Plain text — the shortened URL on success, error message on failure. 

|**Scenario**|**Response**|
|---|---|
|Success|`https://mdpls.in/MEDPLS/7GF0f1`|
|Empty or invalid longUrl|`given long url is not valid`|



## **Sample request (with custom expiry):** 

```
curl
```

```
"https://mdpls.in/shorten-api/shorten?longUrl=https://www.medplusmart.com/products/aspirin&noOfDays=60"
```

## **Sample response:** 

```
https://mdpls.in/MEDPLS/7GF0f1
```

## **Sample request (default 30-day expiry):** 

```
curl "https://mdpls.in/shorten-api/shorten?longUrl=https://www.medplusmart.com/products/aspirin"
```

## **Sample response:** 

```
https://mdpls.in/MEDPLS/aB3xYz
```

## **2. Get Long URL (API)** 

**Endpoint:** `GET /shorten-api/long` 

1 / 2 

|**Parameter**|**Type**|**Required**|**Description**|
|---|---|---|---|
|`shortUrl`|String|Yes|The shortened URL to resolve|



## **Validation rules:** 

- `shortUrl` cannot be null or empty 

**Response format:** Plain text — the original long URL on success, error message on failure. 

|**Scenario**|**Response**|
|---|---|
|Success|`https://www.medplusmart.com/products/aspirin`|
|Short URL not found or expired in Redis|`given url is invalid or may be expired`|
|Empty shortUrl|`given url is invalid or may be expired`|



## **Sample request:** 

```
curl "https://mdpls.in/shorten-api/long?shortUrl=https://mdpls.in/MEDPLS/7GF0f1"
```

## **Sample response:** 

```
https://www.medplusmart.com/products/aspirin
```

## **Sample request (expired/invalid):** 

```
curl "https://mdpls.in/shorten-api/long?shortUrl=https://mdpls.in/MEDPLS/xxxxxx"
```

## **Sample response:** 

```
given url is invalid or may be expired
```

2 / 2 

