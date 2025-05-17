<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  isProcessing: boolean
  icon?: string
  placeholder?: string
  isDisabled?: boolean
  showClose?: boolean
}>()

const emit = defineEmits(['close', 'action'])

const inputValue = ref('')
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-2xl font-semibold">{{ title }}</h3>
      <button v-if="showClose !== false" @click="$emit('close')" class="cursor-pointer rounded-md p-1 leading-4">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <slot>
      <div class="flex items-center">
        <input
          type="text"
          v-model="inputValue"
          :placeholder="placeholder"
          class="basis-full rounded-md border-1 border-gray-300 p-2"
          @keyup.enter="emit('action', inputValue)"
        />
        <button
          @click="emit('action', inputValue)"
          class="m-2 flex cursor-pointer items-center rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
          :disabled="isProcessing || isDisabled || !inputValue"
          :class="{ 'cursor-default opacity-50': isProcessing || isDisabled || !inputValue }"
        >
          <span v-if="isProcessing" class="material-symbols-outlined animate-spin">refresh</span>
          <span v-else class="material-symbols-outlined">{{ icon }}</span>
        </button>
      </div>
    </slot>
  </div>
</template>
