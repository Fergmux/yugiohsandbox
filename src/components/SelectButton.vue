<script setup lang="ts">
defineProps<{
  selected: boolean
}>()
</script>

<template>
  <button
    class="flex items-center rounded-md border p-2"
    :class="{ 'border-gray-300': selected, 'border-gray-500': !selected }"
  >
    <span v-if="selected" class="material-symbols-outlined mr-1 !text-sm"> check </span>
    <span v-else class="material-symbols-outlined mr-1 !text-sm"> close </span>
    <slot />
  </button>
</template>
