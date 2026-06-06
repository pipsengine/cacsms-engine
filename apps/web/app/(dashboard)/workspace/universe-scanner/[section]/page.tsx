import { notFound } from "next/navigation";
import { UniverseScannerPage } from "../../../../../components/universe-scanner/UniverseScannerPage";
import { scannerPageMap, scannerPages } from "../../../../../lib/universe-scanner/scanner-pages";

export function generateStaticParams() {
  return scannerPages.map((page) => ({ section: page.slug }));
}

export default async function UniverseScannerSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = scannerPageMap.get(section);
  if (!page) notFound();
  return <UniverseScannerPage page={page} />;
}
