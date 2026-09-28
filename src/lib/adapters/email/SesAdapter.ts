import { GetAccountCommand, SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Channel } from '@/types';
import {
  errorMessage, requireFields,
  type AdapterConfig, type IMessagingAdapter, type SendPayload, type SendResult, type TestResult,
} from '../IMessagingAdapter';

export class SesAdapter implements IMessagingAdapter {
  readonly channel: Channel = 'EMAIL';
  readonly provider = 'AWS_SES';
  private readonly client: SESv2Client;

  constructor(private readonly config: AdapterConfig) {
    requireFields(config, ['accessKeyId', 'secretAccessKey', 'region', 'senderAddress'], 'AWS SES');
    this.client = new SESv2Client({
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async send(payload: SendPayload): Promise<SendResult> {
    try {
      const out = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: payload.senderAddress || this.config.senderAddress,
          Destination: { ToAddresses: [payload.recipient] },
          Content: {
            Simple: {
              Subject: { Data: payload.subject ?? '', Charset: 'UTF-8' },
              Body: {
                ...(payload.html ? { Html: { Data: payload.html, Charset: 'UTF-8' } } : {}),
                Text: { Data: payload.body, Charset: 'UTF-8' },
              },
              Headers: Object.entries(payload.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
            },
          },
        }),
      );
      return { success: true, resultCode: 'SUCCESS', messageId: out.MessageId ?? '', providerResponse: { messageId: out.MessageId } };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const bounced = name === 'MessageRejected' || name === 'AccountSuspendedException';
      return { success: false, resultCode: bounced ? 'BOUNCED' : 'FAILED', errorMessage: errorMessage(err), providerResponse: { name } };
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      const out = await this.client.send(new GetAccountCommand({}));
      return {
        connected: true,
        message: out.ProductionAccessEnabled ? 'AWS SES 연결 성공' : 'AWS SES 연결 성공 (샌드박스 모드 — 인증된 주소로만 발송 가능)',
        providerInfo: { sendingEnabled: out.SendingEnabled, max24HourSend: out.SendQuota?.Max24HourSend },
      };
    } catch (err) {
      return { connected: false, message: errorMessage(err) };
    }
  }
}
