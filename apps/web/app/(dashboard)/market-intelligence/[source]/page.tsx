type PageProps = { params: Promise<{ source: string }> };

export default async function MarketIntelligenceSourcePage({ params }: PageProps) {
  const { source } = await params;
  return <main><h1>Market Intelligence Center</h1><p>Source: {source}</p></main>;
}
