import {
  createCookie,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Form, useNavigation } from "@remix-run/react";
import { LoaderCircle, Mail } from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { z } from "zod";
import { LoginPageLayout } from "~/components/layout/login-page-layout";
import { Button } from "~/components/ui";
import { Fieldset } from "~/components/ui/Fieldset";
import { FormButtons } from "~/components/ui/FormButtons";
import { Input } from "~/components/ui/input";
import { Paragraph } from "~/components/ui/Paragraph";
import { Cookie } from "@mjackson/headers";
import { authenticator } from "~/services/auth.server";
import { getUserId } from "~/services/session.server";
import {
  commitSession,
  getUserSession,
} from "~/services/sessionStorage.server";
import { env } from "~/env.server";
import { useEffect } from "react";

export const meta: MetaFunction = ({ matches }) => {
  const parentMeta = matches
    .flatMap((match) => match.meta ?? [])
    .filter((meta) => {
      if ("title" in meta) return false;
      if ("name" in meta && meta.name === "viewport") return false;
      return true;
    });

  return [
    ...parentMeta,
    { title: `Login to C.O.R.E.` },
    {
      name: "viewport",
      content: "width=device-width,initial-scale=1",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs): Promise<any> {
  if (!env.ENABLE_EMAIL_LOGIN) {
    return typedjson({ emailLoginEnabled: false });
  }

  const userId = await getUserId(request);
  if (userId) return redirect("/");

  const session = await getUserSession(request);
  const error = session.get("auth:error");

  let magicLinkError: string | undefined | unknown;
  if (error) {
    if ("message" in error) {
      magicLinkError = error.message;
    } else {
      magicLinkError = JSON.stringify(error, null, 2);
    }
  }

  const magicLinkSent = new Cookie(request.headers.get("cookie") ?? "").has(
    "core:magiclink",
  );

  // Captura o magic link do header se disponível
  const magicLink = request.headers.get("X-Magic-Link");
  
  // Tenta capturar da session também
  const sessionMagicLink = session.get("magicLink");
  
  const finalMagicLink = magicLink || sessionMagicLink;

  return typedjson(
    {
      emailLoginEnabled: true,
      magicLinkSent,
      magicLinkError,
      magicLink: finalMagicLink || undefined,
    },
    {
      headers: { "Set-Cookie": await commitSession(session) },
    },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (!env.ENABLE_EMAIL_LOGIN) {
    throw new Error("Magic link login is not enabled");
  }

  const clonedRequest = request.clone();

  const payload = Object.fromEntries(await clonedRequest.formData());

  const { action } = z
    .object({
      action: z.enum(["send", "reset"]),
    })
    .parse(payload);

  if (action === "send") {
    const headers = await authenticator
      .authenticate("email-link", request)
      .catch(async (headers) => {
        // Tenta capturar o magic link do global storage
        const magicLink = (global as any).__lastMagicLink;
        
        if (magicLink) {
          // Armazena na session como fallback
          const session = await getUserSession(request);
          session.set("magicLink", magicLink);
          
          if (headers instanceof Headers) {
            // Adiciona o magic link como um header para ser exibido no cliente
            headers.append("X-Magic-Link", magicLink);
            // Adiciona o cookie da session atualizada
            headers.append("Set-Cookie", await commitSession(session));
          }
        }
        
        return headers;
      });
    
    // Limpa o magic link do global storage
    delete (global as any).__lastMagicLink;
    
    throw redirect("/login/magic", { headers });
  } else {
    const myCookie = createCookie("core:magiclink");

    return redirect("/login/magic", {
      headers: {
        "Set-Cookie": await myCookie.serialize("", {
          maxAge: 0,
          path: "/",
        }),
      },
    });
  }
}

export default function LoginMagicLinkPage() {
  const data = useTypedLoaderData<typeof loader>();
  const navigate = useNavigation();

  // Exibe o magic link no console do navegador quando disponível
  useEffect(() => {
    if (data.magicLink) {
      console.log(
        "%c🔗 Magic Link para login:",
        "color: #0066cc; font-size: 16px; font-weight: bold;"
      );
      console.log(
        `%c${data.magicLink}`,
        "color: #00aa00; font-size: 14px; font-family: monospace; background: #f0f0f0; padding: 4px; border-radius: 4px;"
      );
      console.log(
        "%cClique no link acima ou copie e cole no navegador para fazer login",
        "color: #666; font-size: 12px;"
      );
      
      // Também cria um botão flutuante para fácil acesso
      const floatingButton = document.createElement('div');
      floatingButton.id = 'magic-link-helper';
      floatingButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #0066cc;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        cursor: pointer;
        max-width: 300px;
        word-break: break-all;
      `;
      floatingButton.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: bold;">🔗 Magic Link Disponível!</div>
        <div style="font-size: 12px; opacity: 0.9;">Clique aqui para fazer login</div>
      `;
      floatingButton.onclick = () => {
        window.open(data.magicLink, '_blank');
      };
      document.body.appendChild(floatingButton);
      
      // Remove o botão após 5 minutos
      setTimeout(() => {
        const button = document.getElementById('magic-link-helper');
        if (button) {
          button.remove();
        }
      }, 5 * 60 * 1000);
      
      return () => {
        // Cleanup se o componente for desmontado
        const button = document.getElementById('magic-link-helper');
        if (button) {
          button.remove();
        }
      };
    }
  }, [data.magicLink]);

  if (!data.emailLoginEnabled) {
    return (
      <LoginPageLayout>
        <Paragraph className="text-center">
          Magic link login is not enabled.
        </Paragraph>
      </LoginPageLayout>
    );
  }

  const isLoading =
    (navigate.state === "loading" || navigate.state === "submitting") &&
    navigate.formAction !== undefined &&
    navigate.formData?.get("action") === "send";

  return (
    <LoginPageLayout>
      <Form method="post">
        <div className="flex flex-col items-center justify-center">
          {data.magicLinkSent ? (
            <Card className="min-w-[400px] rounded-md bg-transparent p-3">
              <CardHeader className="flex flex-col items-start">
                <CardTitle className="mb-0 text-xl">
                  Check your magic link
                </CardTitle>
                <CardDescription className="text-md">
                  The magic link is printed in the container logs if you are
                  using Docker, otherwise check your server logs.
                </CardDescription>
              </CardHeader>

              <Fieldset className="flex w-full flex-col items-center gap-y-2 px-2">
                <FormButtons
                  cancelButton={<></>}
                  confirmButton={
                    <Button
                      type="submit"
                      name="action"
                      value="reset"
                      size="lg"
                      variant="secondary"
                      data-action="re-enter email"
                    >
                      Re-enter email
                    </Button>
                  }
                />
              </Fieldset>
            </Card>
          ) : (
            <Card className="w-full max-w-[350px] rounded-md bg-transparent p-3">
              <CardHeader className="flex flex-col items-start">
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription className="text-md">
                  Create an account or login using email
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pl-2">
                <Fieldset className="flex w-full flex-col items-center gap-y-2">
                  <Input
                    type="email"
                    name="email"
                    className="h-9"
                    spellCheck={false}
                    placeholder="Email Address"
                    required
                    autoFocus
                  />

                  <div className="flex w-full">
                    <Button
                      name="action"
                      value="send"
                      type="submit"
                      variant="secondary"
                      full
                      size="xl"
                      className="w-full"
                      disabled={isLoading}
                      data-action="send a magic link"
                    >
                      {isLoading ? (
                        <LoaderCircle className="text-primary h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="text-text-bright mr-2 size-5" />
                      )}
                      {isLoading ? (
                        <span className="text-text-bright">Sending…</span>
                      ) : (
                        <span className="text-text-bright">
                          Send a magic link
                        </span>
                      )}
                    </Button>
                  </div>
                  {data.magicLinkError && <>{data.magicLinkError}</>}
                </Fieldset>
              </CardContent>
            </Card>
          )}
        </div>
      </Form>
    </LoginPageLayout>
  );
}
