<script setup lang="ts">
import { ref, watch } from 'vue'
import NumberAnimation from 'vue-number-animation'

const props = defineProps<{
  lifePoints: number
  reverse?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', value: number): void
}>()

const lifePointsFrom = ref(props.lifePoints)
const lifePointsInput = ref(0)

const changeLifePointsInput = (value: number) => {
  lifePointsInput.value += value
  if (lifePointsInput.value < 0) lifePointsInput.value = 0
}

const changeLifePoints = (value: number) => {
  if (lifePointsInput.value === 0) return
  emit('update', lifePointsInput.value * value)
  lifePointsInput.value = 0
}

const formatLifePoints = (number: number) => {
  return Math.floor(number / 10) * 10
}

const beat = new Audio('/life_points.mp3')

watch(
  () => props.lifePoints,
  () => {
    beat.play()
  },
)
</script>

<template>
  <div class="flex flex-col items-center justify-around">
    <span
      v-if="!reverse"
      class="text-lg font-bold text-yellow-300 md:text-xl lg:text-2xl xl:text-3xl"
      ><NumberAnimation
        :from="lifePointsFrom"
        :to="props.lifePoints"
        :format="formatLifePoints"
        :duration="1.6"
        @complete="lifePointsFrom = props.lifePoints"
      />
      LP</span
    >
    <div class="flex items-center gap-0.5 text-xs font-bold md:gap-1">
      <div class="flex flex-col items-center gap-0.5 lg:gap-1">
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(50)"
        >
          +
        </button>
        <p>50</p>
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(-50)"
        >
          -
        </button>
      </div>
      <div class="flex flex-col items-center gap-0.5 lg:gap-1">
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(100)"
        >
          +
        </button>
        <p>100</p>
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(-100)"
        >
          -
        </button>
      </div>
      <div class="flex flex-col items-center gap-0.5 lg:gap-1">
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(500)"
        >
          +
        </button>
        <p>500</p>
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(-500)"
        >
          -
        </button>
      </div>
      <div class="flex flex-col items-center gap-0.5 lg:gap-1">
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(1000)"
        >
          +
        </button>
        <p>1k</p>
        <button
          class="h-4 w-4 rounded-full border-1 border-gray-300 bg-gray-400 leading-1 text-black active:bg-gray-200 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
          @click="changeLifePointsInput(-1000)"
        >
          -
        </button>
      </div>
    </div>
    <div class="flex items-center">
      <button
        class="h-4 w-4 rounded-full border-1 border-gray-300 bg-red-600 text-center leading-1 text-black active:bg-red-300 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
        @click="changeLifePoints(-1)"
      >
        -
      </button>
      <input
        class="mx-2 w-12 text-center text-lg"
        type="number"
        step="50"
        v-model="lifePointsInput"
      />
      <button
        class="h-4 w-4 rounded-full border-1 border-gray-300 bg-green-500 leading-1 text-black active:bg-green-300 lg:h-5 lg:w-5 xl:h-6 xl:w-6"
        @click="changeLifePoints(1)"
      >
        +
      </button>
    </div>
    <span
      v-if="reverse"
      class="text-lg font-bold text-yellow-300 md:text-xl lg:text-2xl xl:text-3xl"
      ><NumberAnimation
        :from="lifePointsFrom"
        :to="props.lifePoints"
        :format="formatLifePoints"
        :duration="1.6"
        @complete="lifePointsFrom = props.lifePoints"
      />
      LP</span
    >
  </div>
</template>
