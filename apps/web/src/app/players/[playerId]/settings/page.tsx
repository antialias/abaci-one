import { PlayerSettingsClient } from './PlayerSettingsClient'

interface PlayerSettingsPageProps {
  params: { playerId: string }
}

export default function PlayerSettingsPage({ params }: PlayerSettingsPageProps) {
  return <PlayerSettingsClient playerId={params.playerId} />
}
