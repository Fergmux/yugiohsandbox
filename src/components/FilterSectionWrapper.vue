<script setup lang="ts">
defineProps<{
  selected?: number
  total?: number
  depth?: number
  range?: [number | string, number | string]
  defaultRange?: [number | string, number | string]
}>()

const hidden = defineModel('hidden', { default: true })

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="mb-2">
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex items-center">
        <span class="material-symbols-outlined">{{
          hidden ? 'arrow_drop_up' : 'arrow_drop_down'
        }}</span>
        <h4
          class="flex cursor-pointer flex-wrap items-baseline text-xl font-semibold"
          @click="hidden = !hidden"
          :style="depth !== undefined ? { fontSize: `${1.25 - depth * 0.15}rem` } : {}"
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
            v-else-if="
              range &&
              defaultRange &&
              (range[0] !== defaultRange[0] || range[1] !== defaultRange[1])
            "
            class="ml-1 text-sm text-green-400"
          >
            {{ range[0] }} - {{ range[1] }}
          </span>
        </h4>
      </div>
      <button class="cursor-pointer" @click="emit('action')">
        <slot name="action">Reset</slot>
      </button>
    </div>
    <div v-if="!hidden" class="mt-2 ml-4">
      <slot />
    </div>
  </div>
</template>
