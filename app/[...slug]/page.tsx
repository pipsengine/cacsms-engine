import { notFound } from "next/navigation";
import { CommandCenterPage } from "@/components/command-center-page";
import { findPageByPath } from "@/lib/navigation";

type RouteParams = {
  params: Promise<{ slug: string[] }>;
};

export default async function DynamicModulePage({ params }: RouteParams) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;
  const page = findPageByPath(path);

  if (!page) {
    notFound();
  }

  return <CommandCenterPage path={path} />;
}
