<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    scale?: number
  }>(),
  {
    scale: 1,
  },
)
</script>
<template>
  <button
    class="group relative flex items-center justify-center rounded-full border-1 border-gray-300 bg-gray-400 text-black active:bg-gray-600"
    :style="{
      width: `min(${2.5 * scale}vh, ${2.5 * scale}vw)`,
      height: `min(${2.5 * scale}vh, ${2.5 * scale}vw)`,
    }"
  >
    <span class="material-symbols-outlined" :style="{ fontSize: `min(${1.5 * scale}vh, ${1.5 * scale}vw)` }">
      <slot></slot>
    </span>
    <span
      class="pointer-events-none absolute bottom-full left-1/2 z-[99999] mb-1 -translate-x-1/2 rounded bg-gray-900 px-1.5 py-0.5 text-[min(1vh,1vw)] whitespace-nowrap text-white opacity-0 transition-opacity delay-500 group-hover:opacity-100"
    >
      {{ title }}
    </span>
  </button>
</template>
