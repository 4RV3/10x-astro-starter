export const prerender = false;

export async function GET() {
  return new Response(null, { status: 307, headers: { Location: '/study/due-cards' } });
}
