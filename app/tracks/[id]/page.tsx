import TrackDetailClient from "./track-detail-client"

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TrackDetailClient trackId={id} />
}


