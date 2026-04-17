import { useParams } from 'react-router-dom'

export default function RideSummary() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ride summary</h1>
      <p className="mt-2 text-sm text-neutral-500">id: {id}</p>
      <p className="mt-4 text-neutral-400">
        Stats + map + PNG export will render here.
      </p>
    </div>
  )
}
