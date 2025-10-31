// Empty response for Chrome DevTools - prevents 404 error in console
export function loader() {
  return new Response(null, { status: 404 });
}
