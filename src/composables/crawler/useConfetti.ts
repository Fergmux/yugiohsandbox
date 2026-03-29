import confetti from 'canvas-confetti'

export function useConfetti() {
  function celebrate(duration: number = 500) {
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      })
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      })

      if (Date.now() < end) requestAnimationFrame(frame)
    }

    frame()
  }

  return { celebrate }
}
