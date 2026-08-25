#!/bin/sh
# Creates the S3 bucket that the app users upload their files to.
awslocal s3 mb s3://handyman-bucket

# Configure CORS so browser preflight (OPTIONS) and cross-origin PUT/GET succeed.
awslocal s3api put-bucket-cors --bucket handyman-bucket --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length"]
    }
  ]
}'
