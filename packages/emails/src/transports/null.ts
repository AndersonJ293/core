import { render } from "@react-email/render";
import { MailMessage, MailTransport, PlainTextMailMessage } from "./index";

export type NullMailTransportOptions = {
  type: undefined,
}

export class NullMailTransport implements MailTransport {
  private magicLink: string | null = null;

  constructor(options: NullMailTransportOptions) {
  }

  async send({to, subject, react}: MailMessage): Promise<void> {
    const renderedContent = render(react, {
      plainText: true,
    });

    // Extrai o magic link do conteúdo renderizado
    const magicLinkMatch = renderedContent.match(/https?:\/\/[^\s]+/);
    if (magicLinkMatch) {
      this.magicLink = magicLinkMatch[0];
    }

    console.log(`
##### sendEmail to ${to}, subject: ${subject}

${renderedContent}
    `);
  }

  async sendPlainText({to, subject, text}: PlainTextMailMessage): Promise<void> {
    console.log(`
##### sendEmail to ${to}, subject: ${subject}

${text}
    `);
  }

  // Método para obter o último magic link capturado
  getLastMagicLink(): string | null {
    return this.magicLink;
  }
}
