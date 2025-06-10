import {
  redirect,
  createCookie,
  type ActionFunction,
  type LoaderFunction,
} from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

export let loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");

  try {
    // call authenticate as usual, in successRedirect use returnTo or a fallback
    const rf = await authenticator.authenticate("google", request);

    return rf;
  } catch (error) {
    // here we catch anything authenticator.authenticate throw, this will
    // include redirects
    // if the error is a Response and is a redirect
    if (error instanceof Response) {
      // we need to append a Set-Cookie header with a cookie storing the
      // returnTo value
      error.headers.append(
        "Set-Cookie",
        await redirectCookie.serialize(redirectTo),
      );
    }

    throw error;
  }
};

export const redirectCookie = createCookie("redirect-to", {
  maxAge: 60 * 60, // 1 hour
  httpOnly: true,
});
