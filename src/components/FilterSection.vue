<script setup lang="ts">
import Selectlist from './SelectList.vue'

defineProps<{
  options: string[]
}>()

const selected = defineModel<string[]>({ required: true })

const hidden = defineModel('hidden', { default: true })

const emit = defineEmits(['selectAll'])
</script>

<template>
  <div class="mt-4">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h4 class="cursor-pointer text-xl font-semibold" @click="hidden = !hidden">
        <slot />
      </h4>
      <button class="cursor-pointer" @click="emit('selectAll')">
        {{ selected.length < options.length ? 'Select all' : 'Deselect all' }}
      </button>
    </div>
    <div v-if="!hidden" class="mt-2">
      <Selectlist v-model="selected" :options="options" />
    </div>
  </div>
</template>
