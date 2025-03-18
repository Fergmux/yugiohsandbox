declare module 'vue-number-animation' {
  import { DefineComponent } from 'vue'

  interface NumberAnimationProps {
    from: number
    to: number
    format?: (value: number) => number | string
    duration?: number
    easing?: string
    delay?: number
  }

  interface NumberAnimationEmits {
    (e: 'complete'): void
  }

  const NumberAnimation: DefineComponent<
    NumberAnimationProps,
    object,
    object,
    object,
    object,
    object,
    object,
    NumberAnimationEmits
  >

  export default NumberAnimation
}
