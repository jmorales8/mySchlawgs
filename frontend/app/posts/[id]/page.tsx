import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Community from "../../components/community/community";

export const metadata: Metadata = {
  title: "A moment worth sharing | mySchlawgs",
  description: "See this schlawg’s photos and join the conversation. No account needed to view.",
};

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ discovery?: string | string[]; notificationComment?: string | string[]; photo?: string | string[] }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const { discovery, notificationComment, photo } = await searchParams;
  const category = discovery === "popular" || discovery === "niche" || discovery === "relevant" || discovery === "iotw" ? discovery : undefined;
  const commentId = typeof notificationComment === "string" && uuid.test(notificationComment) ? notificationComment.toLowerCase() : undefined;
  const photoId = typeof photo === "string" && uuid.test(photo) ? photo.toLowerCase() : undefined;
  return <Community key={`${id}-${category ?? "post"}-${commentId ?? ""}-${photoId ?? ""}`} postId={id} discovery={category} notificationCommentId={commentId} initialPhotoId={photoId} />;
}
