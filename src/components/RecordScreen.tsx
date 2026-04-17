export default function RecordScreen() {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ready to ride?</h1>
        <p className="mt-2 text-neutral-400">
          Tap Start, keep the screen on, and ride. We'll track your route.
        </p>
      </div>
      <button
        type="button"
        disabled
        className="h-40 w-40 rounded-full bg-moto-orange text-xl font-semibold text-white shadow-lg shadow-moto-orange/30 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start
      </button>
      <p className="text-xs text-neutral-500">
        Recorder wiring lands next. This is just the scaffold.
      </p>
    </div>
  )
}
