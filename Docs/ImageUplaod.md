# ImageUpload APis

first we need to get token from oauth server. for that we need to pass client credentials. here client credentails are encoded with base64 and passed to Autherization like 
my clientId: meditimes_client
password : Med1T!me$CL

we need to encode base64 like meditimes_client:Med1T!me$CL and encoded string is bWVkaXRpbWVzX2NsaWVudDpNZWQxVCFtZSRDTA==

import requests

url = "http://192.168.1.60:8103/oauth-server/oauth/token?grant_type=client_credentials"

payload={}
headers = {
  'Authorization': 'Basic bWVkaXRpbWVzX2NsaWVudDpNZWQxVCFtZSRDTA=='
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)

Response:
===========
>> {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiTUVESVRJTUVTX1JFU09VUkNFIiwiUE9TX1JFU09VUkNFIl0sInNjb3BlIjpbInJlYWQiXSwiZXhwIjoxNzU2MTIxNjA5LCJlbnYiOiJtYXJpZ29sZCIsImlzc3VlZF9hdCI6IjIwMjUtMDgtMjUgMTc6MDE6MjkiLCJqdGkiOiIzZDQ0ODk5MS1lZGUyLTQ0MWYtODQ1Yy02N2RkNzgxYmM0OWIiLCJjbGllbnRfaWQiOiJtZWRpdGltZXNfY2xpZW50In0.4R3uaP6HriNCiwNnRAI_Dn6YnKTuMDnjMPnw-rhQZJ0SQgLvqntmHODsUjJcfld0rT8wostioXmm0wLO9TgvpgaZ_Nm_ExWkUvQtNJA5rtOo_fxiVEYolfAdcx_tIdXfZKfhE3XdUyzZ2bhV-zrO0z7C5_334dgZ-RSTtLqc3l7pfqWTh_mDuO3kf8lrIKX39_lDw8Gg-L2CmQ10qm5Ew44LEXjgSRzVy_Oae50URxtRRigqFVR1VGlKDprEJBoK5Z1025WZG-LLFFaCa3YBq8OAtE8oTWS9jDPn6j5oBpqCzPoGV72_1YsEmFmB8uOoH0u0f9ADj7YQ4re1uVfsJQ",
    "token_type": "bearer",
    "expires_in": 119,
    "scope": "read",
    "env": "marigold",
    "issued_at": "2025-08-25 17:01:29",
    "jti": "3d448991-ede2-441f-845c-67dd781bc49b"
}


Here we will get access token.
using access token we need to fetch imagerserver details by passing origin and clientid.

import requests

url = "https://marigold.medplusindia.com:6426/diagnostics/transit/image-server"

payload={'origin': 'origin',
'clientId': 'clientId'}

headers = {
  'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiTUVESVRJTUVTX1JFU09VUkNFIiwiUE9TX1JFU09VUkNFIl0sInNjb3BlIjpbInJlYWQiXSwiZXhwIjoxNzU2MTIxNjA5LCJlbnYiOiJtYXJpZ29sZCIsImlzc3VlZF9hdCI6IjIwMjUtMDgtMjUgMTc6MDE6MjkiLCJqdGkiOiIzZDQ0ODk5MS1lZGUyLTQ0MWYtODQ1Yy02N2RkNzgxYmM0OWIiLCJjbGllbnRfaWQiOiJtZWRpdGltZXNfY2xpZW50In0.4R3uaP6HriNCiwNnRAI_Dn6YnKTuMDnjMPnw-rhQZJ0SQgLvqntmHODsUjJcfld0rT8wostioXmm0wLO9TgvpgaZ_Nm_ExWkUvQtNJA5rtOo_fxiVEYolfAdcx_tIdXfZKfhE3XdUyzZ2bhV-zrO0z7C5_334dgZ-RSTtLqc3l7pfqWTh_mDuO3kf8lrIKX39_lDw8Gg-L2CmQ10qm5Ew44LEXjgSRzVy_Oae50URxtRRigqFVR1VGlKDprEJBoK5Z1025WZG-LLFFaCa3YBq8OAtE8oTWS9jDPn6j5oBpqCzPoGV72_1YsEmFmB8uOoH0u0f9ADj7YQ4re1uVfsJQ'
}

response = requests.request("GET", url, headers=headers, data=payload, files=files)

print(response.text)

Response:
============
>>{
    "statusCode": "SUCCESS",
    "message": null,
    "response": {
        "imageServerUrl": "https://static1.medplusindia.com:666",
        "logicalName": "static2",
        "accessToken": "ftogQWvcDB1756121532949",
        "clientId": "asd"
    }
}

Here we will get imageserver details.
Now, using imageServerUrl we got from imageserver details, we need to prepare proper url like prepared below. for this we need to pass token and clientId that we got from imageserver details. and pass we need to pass the files to upload.

import requests

url = "https://static1.medplusindia.com:666/upload?token=LrKYWnkXdq1756121018192&clientId=e70bc713b03e9ab9520cabef8e79dc48eb23ff794d95de390ae6c1ca25ae6ee2&imageType=LT"

payload={}
files=[
  ('files',('Screenshot from 2025-07-07 12-09-16.png',open('/home/developer/Pictures/Screenshot from 2025-07-07 12-09-16.png','rb'),'image/png'))
]
headers = {}

response = requests.request("POST", url, headers=headers, data=payload, files=files)

print(response.text)

Response:
==============
>>{
    "statusCode": "SUCCESS",
    "message": null,
    "response": [
        {
            "imagePath": "displayprescriptionimages/static2/transit-images/2025/0825/LT_W_c7a9478496413aaa968e44efcf28487c.png",
            "thumbnailPath": "displayprescriptionimages/static2/transit-images/2025/0825/tn_LT_W_c7a9478496413aaa968e44efcf28487c.png",
            "originalImageName": "Screenshot from 2025-07-07 12-09-16.png",
            "imageServerName": "static2"
        }
    ]
}

finally, we will get paths of that images from server.
we can browse the files using imageServerUrl we got previously and we need to append the imagePath for image and thumbnail path for image thumbnail.
ex:  https://static1.medplusindia.com:666/displayprescriptionimages/static2/transit-images/2025/0825/tn_LT_W_c7a9478496413aaa968e44efcf28487c.png
	https://static1.medplusindia.com:666/displayprescriptionimages/static2/transit-images/2025/0825/LT_W_c7a9478496413aaa968e44efcf28487c.png
	
	
