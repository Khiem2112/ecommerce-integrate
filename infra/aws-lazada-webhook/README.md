# AWS Lazada Webhook Ingress Gateway

Ha tang tiep nhan Lazada IM Webhook theo kien truc 4 lop:
1. AWS API Gateway (HTTP API, region `ap-southeast-1`)
2. AWS Lambda (Node.js 20, xac thuc chu ky HMAC-SHA256 giong `verifyLazadaWebhookSignature`, bo qua probe ping khong co `session_id`)
3. AWS SQS FIFO (`*.fifo`) voi `MessageGroupId = session_id`, `MessageDeduplicationId = message_id` (hoac SHA-256 payload) kem SQS DLQ (`maxReceiveCount = 5`)
4. OmniCart Backend SQS Consumer (`@aws-sdk/client-sqs` Long Polling) day vao BullMQ 8 partitions qua `addChatMessageJob`

## Trien Khai Bang AWS SAM CLI

Yeu cau cai dat truoc: AWS CLI v2 va AWS SAM CLI da cau hinh credentials quyen deploy tai region `ap-southeast-1`.

```bash
cd infra/aws-lazada-webhook
sam build
sam deploy --guided
```

Trong luc chay `sam deploy --guided`, nhap cac tham so:
- `Stack Name`: `omnicart-lazada-webhook`
- `AWS Region`: `ap-southeast-1`
- `LazadaAppKey`: App Key cua ung dung Lazada
- `LazadaAppSecret`: App Secret cua ung dung Lazada
- `LazadaChatAppKey` / `LazadaChatAppSecret`: de trong neu dung chung key chinh
- `SkipSignatureVerify`: `false` (chỉ dung `true` cho sandbox test khong co HMAC hop le)

Sau khi deploy thanh cong, SAM tra ve cac gia tri trong `Outputs`:
- `WebhookEndpointUrl`: dan URL nay vao cau hinh Webhook / Push Mechanism tren Lazada Open Platform Console.
- `SqsQueueUrl`: gan vao bien moi truong `LAZADA_SQS_QUEUE_URL` cua OmniCart backend.
- `SqsConsumerPolicyArn`: gan IAM Managed Policy nay vao IAM Role (EC2/ECS/EKS) hoac IAM User ma OmniCart backend su dung.

## Kiem Tra Va Xu Ly Su Co DLQ

Neu OmniCart backend hoac Redis gap su co khien consumer khong enqueue duoc vao BullMQ qua 5 lan (`maxReceiveCount = 5`), tin nhan tu dong duoc chuyen sang `SqsDlqUrl`. Sau khi khac phuc su co backend, su dung tinh nang **Start DLQ redrive** tren AWS SQS Console de day nguoc tin nhan tu DLQ tro lai hang doi chinh theo dung thu tu FIFO.
