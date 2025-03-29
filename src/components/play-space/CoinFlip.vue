<template>
  <div class="coin-container" @click="flip()">
    <div
      class="coin cursor-pointer"
      :class="{ flipping: isFlipping }"
      :style="{ transform: `rotateY(${rotation}deg)` }"
    >
      <div class="side heads">Heads</div>
      <div class="side tails">Tails</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineEmits, defineExpose, ref } from 'vue'

const isFlipping = ref(false)
const rotation = ref(0)
const currentSide = ref('heads')
const emit = defineEmits(['flip'])

const flip = (desiredSide?: 'heads' | 'tails') => {
  if (isFlipping.value) return
  isFlipping.value = true

  const result = desiredSide || (Math.random() > 0.5 ? 'heads' : 'tails')

  // Only emit event if no desired side was provided
  if (!desiredSide) {
    emit('flip', result)
  }

  // Ensure at least 5 full spins before stopping
  const additionalRotations = 5 + Math.floor(Math.random() * 4)
  let newRotation = 180 * additionalRotations

  // Check what the final side should be after rotation
  const finalIsHeads = ((rotation.value + newRotation) / 180) % 2 === 0

  // If the final side doesn't match the desired side, add 180 degrees
  if ((result === 'heads' && !finalIsHeads) || (result === 'tails' && finalIsHeads)) {
    newRotation += 180
  }

  rotation.value += newRotation

  // Simulate flip animation duration
  setTimeout(() => {
    currentSide.value = result
    isFlipping.value = false
  }, 3000)
}

defineExpose({ flip })
</script>

<style scoped>
.coin-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  width: 100px;
  perspective: 1000px;
}

.coin {
  width: 80px;
  height: 80px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 3s;
}

.side {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  color: white;
  backface-visibility: hidden;
}

.heads {
  background-color: gold;
}

.tails {
  background-color: silver;
  transform: rotateY(180deg);
}
</style>
