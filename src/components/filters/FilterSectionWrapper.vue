<script setup lang="ts">
import { type Ref } from 'vue'

defineProps<{
  selected?: number
  total?: number
  depth?: number
  range?: { min: number | string; max: number | string }
  defaultRange?: { min: number | string; max: number | string }
  hasLockedChildren?: boolean
}>()

const shown = defineModel('shown', { default: true })
const locked: Ref<boolean | Record<number, boolean>> = defineModel('locked', { default: false })

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="mb-2">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex items-center">
        <span class="material-symbols-outlined">{{ shown ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
        <h4
          @click="shown = !shown"
          class="flex cursor-pointer flex-wrap items-baseline text-xl"
          :style="depth !== undefined ? { fontSize: `${1.25 - depth * 0.1}rem` } : {}"
        >
          <slot name="title" />
          <span
            v-if="selected != undefined && total && selected !== total"
            class="ml-1 text-sm text-neutral-200"
            :class="{
              'text-red-400': selected === 0,
              'text-yellow-200': selected > 0 && selected < total,
            }"
          >
            {{ selected }} / {{ total }}
          </span>
          <span v-else-if="selected && total === undefined" class="ml-1 text-sm text-green-400">
            {{ selected }}
          </span>
          <span
            v-else-if="range && defaultRange && (range.min !== defaultRange.min || range.max !== defaultRange.max)"
            class="ml-1 text-sm text-green-400"
          >
            {{ range.min }} - {{ range.max }}
          </span>
          <span
            class="material-symbols-outlined self-center"
            @click.stop="locked = !locked"
            :class="{
              'text-neutral-100': locked,
              'text-yellow-200': hasLockedChildren && !locked,
            }"
          >
            {{ locked ? 'lock' : 'lock_open' }}
          </span>
        </h4>
      </div>
      <button class="cursor-pointer" @click="emit('action')">
        <slot name="action">Reset</slot>
      </button>
    </div>
    <div v-if="shown" class="mt-2 ml-4">
      <slot />
    </div>
  </div>
</template>
