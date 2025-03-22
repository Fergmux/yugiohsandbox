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
    class="flex items-center justify-center rounded-full border-1 border-gray-300 bg-gray-400 text-black active:bg-gray-600"
    :style="{
      // padding: `min(${0.5 * scale}vh, ${0.5 * scale}vw)`,
      // lineHeight: `min(${1 * scale}vh, ${1 * scale}vw)`,
      width: `min(${2.5 * scale}vh, ${2.5 * scale}vw)`,
      height: `min(${2.5 * scale}vh, ${2.5 * scale}vw)`,
    }"
  >
    <span
      class="material-symbols-outlined"
      :style="{ fontSize: `min(${1.5 * scale}vh, ${1.5 * scale}vw)` }"
      :title
    >
      <slot></slot>
    </span>
  </button>
</template>
