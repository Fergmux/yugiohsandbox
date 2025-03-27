<script setup lang="ts">
defineProps<{
  selected: boolean
}>()
</script>

<template>
  <button
    class="flex cursor-pointer items-center rounded-md border px-2 py-1"
    :class="{ 'border-gray-300': selected, 'border-gray-500': !selected }"
  >
    <span v-if="selected" class="material-symbols-outlined mr-1 !text-sm"> check </span>
    <span v-else class="material-symbols-outlined mr-1 !text-sm"> close </span>
    <slot />
  </button>
</template>
