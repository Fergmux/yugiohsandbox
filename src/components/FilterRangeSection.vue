<script setup lang="ts">
defineProps<{
  minLabel?: string
  maxLabel?: string
}>()

const emit = defineEmits(['reset'])

const min = defineModel<number>('min', { required: true })
const max = defineModel<number>('max', { required: true })

const hidden = defineModel('hidden', { default: true })
</script>

<template>
  <div class="mt-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h4 class="cursor-pointer text-xl font-semibold" @click="hidden = !hidden">
        <slot />
      </h4>
      <button class="cursor-pointer" @click="emit('reset')">Reset</button>
    </div>
    <div v-if="!hidden" class="mt-2 flex items-center gap-4">
      <div class="flex items-center gap-2">
        <label>{{ minLabel || 'Min' }}:</label>
        <input type="number" v-model="min" class="w-20 rounded-md border-1 border-gray-300 p-1" />
      </div>
      <div class="flex items-center gap-2">
        <label>{{ maxLabel || 'Max' }}:</label>
        <input type="number" v-model="max" class="w-20 rounded-md border-1 border-gray-300 p-1" />
      </div>
    </div>
  </div>
</template>
