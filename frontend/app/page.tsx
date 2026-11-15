import Community from "./components/community/community";

export default async function Home({ searchParams }: { searchParams: Promise<{ feed?: string | string[] }> }) {
  const { feed } = await searchParams;
  const initialFeed = feed === "interacted" || feed === "mine" ? feed : "latest";

  return <Community key={initialFeed} initialFeed={initialFeed} />;
}
