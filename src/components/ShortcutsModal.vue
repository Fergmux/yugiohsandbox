<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const cardSelectedShortcuts = [
  { key: 'G', description: 'Send to graveyard' },
  { key: 'H', description: 'Return to hand' },
  { key: 'B', description: 'Send to banished zone' },
  { key: 'F', description: 'Place on field zone' },
  { key: 'P', description: 'Pass card to opponent' },
]

const noCardSelectedShortcuts = [
  { key: 'G', description: 'Inspect graveyard' },
  { key: 'D', description: 'Draw a card from deck' },
  { key: 'S', description: 'Search deck' },
  { key: 'L', description: 'Focus player life points' },
  { key: 'O', description: 'Focus opponent life points' },
  { key: 'Space', description: 'Next turn phase' },
  { key: 'Enter', description: 'Auto-draw (discard hand, then draw)' },
]

type MouseShortcut = {
  key: string
  targets: { target: string; description: string }[]
}

const mouseShortcuts: MouseShortcut[] = [
  {
    key: 'Shift + Click',
    targets: [
      { target: 'Hand card', description: 'Play face up to field' },
      { target: 'Field card', description: 'Send to graveyard' },
    ],
  },
  {
    key: 'Shift + Right Click',
    targets: [
      { target: 'Hand card', description: 'Set face down to field' },
      { target: 'Spell / Trap', description: 'Flip face up / face down' },
      { target: 'Monster (face down)', description: 'Flip face up' },
      { target: 'Monster (face up)', description: 'Toggle attack / defence' },
    ],
  },
  {
    key: 'Right Click',
    targets: [{ target: 'Any card / zone', description: 'Inspect' }],
  },
]

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keyup', handleKeyUp, true))
onBeforeUnmount(() => window.removeEventListener('keyup', handleKeyUp, true))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] flex items-center justify-center" @click="emit('close')">
      <div class="max-w-3xl rounded-md border-1 border-gray-300 bg-neutral-900 p-6" @click.stop>
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Shortcuts</h2>
          <button class="cursor-pointer rounded-md border-1 border-gray-300 px-2 py-0.5" @click="emit('close')">
            Close
          </button>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <div>
            <h3 class="mb-2 text-sm font-semibold tracking-wide uppercase opacity-60">Card Selected</h3>
            <div class="flex flex-col gap-2">
              <div
                v-for="shortcut in cardSelectedShortcuts"
                :key="shortcut.key"
                class="flex items-center gap-4 rounded-md border-1 border-gray-300 px-3 py-2"
              >
                <kbd class="shrink-0 rounded bg-neutral-700 px-2 py-0.5 font-mono text-sm">{{ shortcut.key }}</kbd>
                <span class="text-sm">{{ shortcut.description }}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold tracking-wide uppercase opacity-60">No Card Selected</h3>
            <div class="flex flex-col gap-2">
              <div
                v-for="shortcut in noCardSelectedShortcuts"
                :key="shortcut.key"
                class="flex items-center gap-4 rounded-md border-1 border-gray-300 px-3 py-2"
              >
                <kbd class="shrink-0 rounded bg-neutral-700 px-2 py-0.5 font-mono text-sm">{{ shortcut.key }}</kbd>
                <span class="text-sm">{{ shortcut.description }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <h3 class="mb-2 text-sm font-semibold tracking-wide uppercase opacity-60">Mouse</h3>
          <div class="flex flex-col gap-3">
            <div
              v-for="shortcut in mouseShortcuts"
              :key="shortcut.key"
              class="rounded-md border-1 border-gray-300 px-3 py-2"
            >
              <kbd class="rounded bg-neutral-700 px-2 py-0.5 font-mono text-sm">{{ shortcut.key }}</kbd>
              <div class="mt-2 flex flex-col gap-1">
                <div v-for="t in shortcut.targets" :key="t.target" class="flex items-center gap-2 text-sm">
                  <span class="opacity-60">{{ t.target }}:</span>
                  <span>{{ t.description }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
