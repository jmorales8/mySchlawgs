import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Community from "../../components/community";

export const metadata: Metadata = {
  title: "A moment worth sharing | mySchlawgs",
  description: "See this schlawg’s photos and join the conversation. No account needed to view.",
};

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ discovery?: string | string[] }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { discovery } = await searchParams;
  const category = discovery === "popular" || discovery === "niche" || discovery === "relevant" ? discovery : undefined;
  return <Community key={`${id}-${category ?? "post"}`} postId={id} discovery={category} />;
}
