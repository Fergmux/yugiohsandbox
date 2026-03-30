<script setup lang="ts">
import { ref, watch } from 'vue'

import NumberAnimation from 'vue-number-animation'

defineExpose({ focus: () => inputRef.value?.focus() })

const props = defineProps<{
  lifePoints: number
  reverse?: boolean
  interactive?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', value: number): void
}>()

const lifePointsFrom = ref(props.lifePoints)
const lifePointsInput = ref(0)
const inputRef = ref<HTMLInputElement>()

// const changeLifePointsInput = (value: number) => {
//   lifePointsInput.value += value
//   if (lifePointsInput.value < 0) lifePointsInput.value = 0
// }

const changeLifePoints = (value: number) => {
  // if (lifePointsInput.value === 0) return
  emit('update', lifePointsInput.value * value)
  lifePointsInput.value = 0
}

const formatLifePoints = (number: number) => {
  return Math.floor(number / 10) * 10
}

const beat = new Audio('/life_points.mp3')

const enterHandler = (shiftKey: boolean) => {
  changeLifePoints(shiftKey ? 1 : -1)
  inputRef.value?.blur()
}

watch(
  () => props.lifePoints,
  () => {
    beat.play()
  },
  { immediate: false },
)
</script>

<template>
  <div class="flex flex-col items-center justify-around">
    <h3 class="text-[min(1.2vh,1.2vw)] font-semibold text-white" v-if="reverse">Your LP</h3>
    <h3 class="text-[min(1.2vh,1.2vw)] font-semibold text-white" v-if="!reverse">Opponent's LP</h3>
    <!-- <span class="text-lg font-bold text-yellow-300 md:text-xl lg:text-2xl xl:text-3xl" -->
    <!-- <input
      type="number"
      class=""
      @keyup.enter="changeLifePoints"
      @blur="changeLifePoints"
      @keyup.escape="resetLifePoints"
      v-model="lifePointsInput"
    /> -->
    <span class="mx-auto w-[min(8vw,8vh)] text-center text-[min(1.8vh,1.8vw)] font-bold text-yellow-300">
      <NumberAnimation
        :from="lifePointsFrom"
        :to="props.lifePoints"
        :format="formatLifePoints"
        :duration="1.6"
        @complete="lifePointsFrom = props.lifePoints"
      />
      LP</span
    >
    <div class="flex items-center">
      <button
        :disabled="!interactive"
        class="h-[min(2vh,2vw)] w-[min(2vh,2vw)] cursor-pointer rounded-full border-1 border-gray-300 bg-red-600 text-center leading-1 text-black active:bg-red-300 disabled:cursor-default disabled:active:bg-red-600"
        @click="changeLifePoints(-1)"
      >
        -
      </button>
      <input
        ref="inputRef"
        class="mx-2 w-[min(4vh,4vw)] text-center text-[min(1.2vh,1.2vw)]"
        type="number"
        step="50"
        v-model="lifePointsInput"
        :disabled="!interactive"
        @keyup.enter.stop="enterHandler($event.shiftKey)"
      />
      <button
        :disabled="!interactive"
        class="h-[min(2vh,2vw)] w-[min(2vh,2vw)] cursor-pointer rounded-full border-1 border-gray-300 bg-green-500 leading-1 text-black active:bg-green-300 disabled:cursor-default disabled:active:bg-green-500"
        @click="changeLifePoints(1)"
      >
        +
      </button>
    </div>
  </div>
</template>
